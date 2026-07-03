import {
  AbsoluteFill, Sequence, OffthreadVideo, Img, Audio,
  interpolate, useCurrentFrame, useVideoConfig, staticFile,
} from 'remotion';

const FADE = 12; // кадров на кросс-фейд вход/выход

// http(s) → как есть; локальный путь → staticFile (из папки public/)
function resolve(src) {
  if (!src) return src;
  return /^https?:\/\//.test(src) ? src : staticFile(src);
}

function Clip({ item, fade = FADE, isFirst = false, isLast = false }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = item;
  // вход/выход по fade; первый клип не проявляем из чёрного, последний не гасим
  // строим строго возрастающие точки; нулевой фейд на краях просто не добавляем
  const times = [];
  const vals = [];
  if (isFirst) {
    times.push(0); vals.push(1);
  } else {
    times.push(0, fade); vals.push(0, 1);
  }
  if (isLast) {
    times.push(durationInFrames); vals.push(1);
  } else {
    times.push(durationInFrames - fade, durationInFrames); vals.push(1, 0);
  }
  const opacity = interpolate(frame, times, vals, {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const src = resolve(item.src);
  const fit = item.fit || 'cover';
  // kenburns только если явно включён (item.kenburns), по умолчанию — чистая картинка
  const scale = item.kenburns
    ? interpolate(frame, [0, durationInFrames], [1.0, 1.05], { extrapolateRight: 'clamp' })
    : 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      {item.type === 'image' ? (
        <AbsoluteFill>
          {/* блюр-фон, чтобы не было чёрных полей */}
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(28px) brightness(.5)', transform: 'scale(1.08)' }} />
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: fit === 'cover' ? 'cover' : 'contain' }} />
        </AbsoluteFill>
      ) : (
        <OffthreadVideo src={src} style={{ width: '100%', height: '100%', objectFit: fit, transform: `scale(${scale})` }} muted={item.muted ?? true} />
      )}
    </AbsoluteFill>
  );
}

function Caption({ text, accent = false }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 12], [40, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 190, paddingLeft: 60, paddingRight: 60 }}>
      <div style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: 'inline-block',
        background: accent ? '#e11414' : 'rgba(0,0,0,.72)',
        borderLeft: accent ? 'none' : '8px solid #e11414',
        color: 'white',
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: 60,
        fontWeight: 900,
        letterSpacing: '-1px',
        textAlign: 'center',
        textTransform: 'uppercase',
        padding: '20px 34px',
        borderRadius: 14,
        lineHeight: 1.08,
        boxShadow: '0 10px 40px rgba(0,0,0,.6)',
      }}>{text}</div>
    </AbsoluteFill>
  );
}

/**
 * props:
 *  items:    [{ src, type:'video'|'image', durationInFrames, muted? }]
 *  audio:    путь/URL музыки (накладывается на весь ролик)
 *  captions: [{ text, fromFrame, toFrame }]
 */
export const Montage = ({ items = [], audio = null, captions = [], crossfade = 0 }) => {
  const cf = Math.max(0, crossfade);
  let start = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {audio ? <Audio src={resolve(audio)} /> : null}
      {items.map((it, i) => {
        const from = start;
        // следующий клип стартует с наложением cf → настоящий кросс-фейд
        start += it.durationInFrames - (i < items.length - 1 ? cf : 0);
        return (
          <Sequence key={i} from={from} durationInFrames={it.durationInFrames}>
            <Clip item={it} fade={cf || FADE} isFirst={i === 0} isLast={i === items.length - 1} />
          </Sequence>
        );
      })}
      {captions.map((c, i) => (
        <Sequence key={`cap${i}`} from={c.fromFrame} durationInFrames={Math.max(c.toFrame - c.fromFrame, 1)}>
          <Caption text={c.text} accent={c.accent} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
