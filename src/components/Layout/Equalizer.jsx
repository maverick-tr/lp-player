import { useRef, useEffect, useState, memo } from 'react';
import { useTheme } from '../../hooks/useTheme';

const BAR_COUNT = 16;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MAX_HEIGHT = 32;

const Equalizer = memo(function Equalizer({ analyserRef }) {
  const { isDarkMode } = useTheme();
  const [bars, setBars] = useState(() => new Array(BAR_COUNT).fill(0));
  const rafRef = useRef(null);
  const dummyIntervalRef = useRef(null);
  const color = isDarkMode ? '#bccc0f' : '#4a5a06';

  useEffect(() => {
    const analyser = analyserRef?.current;

    if (analyser) {
      // Real mode: read frequency data
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.floor(analyser.frequencyBinCount / BAR_COUNT);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const newBars = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const value = dataArray[i * step] || 0;
          newBars.push((value / 255) * MAX_HEIGHT);
        }
        setBars(newBars);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    } else {
      // Dummy mode: smooth random bars
      const tick = () => {
        setBars(prev =>
          prev.map(h => {
            const target = Math.random() * MAX_HEIGHT;
            // Smooth toward target
            return h + (target - h) * 0.3;
          })
        );
      };
      dummyIntervalRef.current = setInterval(tick, 100);
      return () => {
        if (dummyIntervalRef.current) clearInterval(dummyIntervalRef.current);
      };
    }
  }, [analyserRef]);

  const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;

  return (
    <div
      className="flex items-end"
      style={{
        width: totalWidth,
        height: MAX_HEIGHT,
        gap: BAR_GAP,
      }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: BAR_WIDTH,
            height: Math.max(2, h),
            backgroundColor: color,
            opacity: 0.4 + (h / MAX_HEIGHT) * 0.6,
            borderRadius: 1,
            transition: 'height 80ms ease-out',
          }}
        />
      ))}
    </div>
  );
});

export default Equalizer;
