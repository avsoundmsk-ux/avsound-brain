import { Composition } from 'remotion';
import { Montage } from './Montage.jsx';

// Длительность/размер берём из props (calculateMetadata) — динамически под клипы.
const calc = ({ props }) => {
  const total = (props.items || []).reduce((s, i) => s + (i.durationInFrames || 0), 0);
  return {
    durationInFrames: Math.max(total, 60),
    fps: props.fps || 30,
    width: props.width || 1080,
    height: props.height || 1920,
  };
};

export const RemotionRoot = () => (
  <Composition
    id="Montage"
    component={Montage}
    durationInFrames={150}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ items: [], captions: [], audio: null, fps: 30, width: 1080, height: 1920 }}
    calculateMetadata={calc}
  />
);
