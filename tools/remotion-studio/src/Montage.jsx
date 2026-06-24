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

function Clip({ item }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = item;
  const opacity = interpolate(
    frame,
    [0, FADE, durationInFrames - FADE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const src = resolve(item.src);
  return (
    <AbsoluteFill style={{ opacity }}>
      {item.type === 'image'
        ? <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <OffthreadVideo src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted={item.muted ?? true} />}
    </AbsoluteFill>
  );
}

function Caption({ text }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: 80 }}>
      <div style={{
        opacity,
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        fontSize: 64,
        fontWeight: 800,
        textAlign: 'center',
        textShadow: '0 4px 24px rgba(0,0,0,.9)',
        lineHeight: 1.15,
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
export const Montage = ({ items = [], audio = null, captions = [] }) => {
  let start = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {audio ? <Audio src={resolve(audio)} /> : null}
      {items.map((it, i) => {
        const from = start;
        start += it.durationInFrames;
        return (
          <Sequence key={i} from={from} durationInFrames={it.durationInFrames}>
            <Clip item={it} />
          </Sequence>
        );
      })}
      {captions.map((c, i) => (
        <Sequence key={`cap${i}`} from={c.fromFrame} durationInFrames={Math.max(c.toFrame - c.fromFrame, 1)}>
          <Caption text={c.text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
