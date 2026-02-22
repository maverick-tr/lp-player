import { memo } from 'react';
import { useTheme } from '../../hooks/useTheme';
import Equalizer from './Equalizer';

const NowPlayingCard = memo(function NowPlayingCard({ nowPlaying, analyserRef }) {
  const { isDarkMode } = useTheme();

  if (!nowPlaying) return null;

  const { tool, track, quote } = nowPlaying;
  const tags = tool?.tags?.slice(0, 3) || [];
  const port = tool?.port;

  return (
    <div className={`
      rounded-r-lg px-3 py-2 min-w-[220px] max-w-[280px] h-24 flex flex-col justify-center
      ${isDarkMode ? 'bg-tool-darker/90' : 'bg-white/90'}
    `}>
      <div className="flex gap-3">
        {/* Left: project info */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {tool?.name || 'Unknown Project'}
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isDarkMode
                      ? 'bg-[#bccc0f]/15 text-[#bccc0f]/80'
                      : 'bg-[#7a8a0b]/10 text-[#4a5a06]'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {port && (
            <div className={`text-[10px] mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Port: {port}
            </div>
          )}
        </div>

        {/* Right: equalizer */}
        <div className="flex items-center shrink-0">
          <Equalizer analyserRef={analyserRef} />
        </div>
      </div>

      {/* Bottom: track info or quote */}
      <div className="mt-1 pt-1 border-t border-current/5">
        {track ? (
          <>
            <div className={`text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              &ldquo;{track.name}&rdquo; &mdash; {track.artist}
            </div>
            <div className={`text-[9px] mt-0.5 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              provided courtesy of iTunes
            </div>
          </>
        ) : quote ? (
          <div className={`text-xs italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {quote}
          </div>
        ) : (
          <div className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            No preview available
          </div>
        )}
      </div>
    </div>
  );
});

export default NowPlayingCard;
