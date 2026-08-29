import { DeviceEventEmitter } from 'react-native';
import TrackPlayer, { Event } from 'react-native-track-player';
import {
  clearAudioSleepDeadline,
  getAudioSleepDeadline,
  loadAudioPreferences,
} from '../data/audioPreferences';
import {
  AUDIO_REMOTE_CHAPTER_EVENT,
  resolveRemoteQueueIndex,
} from '../core/audioRemoteNavigation';

async function navigateRemote(direction: -1 | 1) {
  const perSegment = loadAudioPreferences().mediaButtonPerNext;
  if (!perSegment) {
    // TODO(htyf-native): a terminated/background-only JS runtime cannot reopen a
    // chapter without the background-audio lifecycle work in docs/htyf-migration-gaps.md.
    DeviceEventEmitter.emit(AUDIO_REMOTE_CHAPTER_EVENT, direction);
    return;
  }
  const [queue, activeIndex] = await Promise.all([
    TrackPlayer.getQueue(),
    TrackPlayer.getActiveTrackIndex(),
  ]);
  const target = resolveRemoteQueueIndex(
    queue,
    activeIndex ?? -1,
    direction,
    true,
  );
  if (target !== undefined) await TrackPlayer.skip(target);
}

export async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    navigateRemote(1).catch(() => undefined),
  );
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    navigateRemote(-1).catch(() => undefined),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpForward, event =>
    TrackPlayer.seekBy(event.interval || 15),
  );
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, event =>
    TrackPlayer.seekBy(-(event.interval || 15)),
  );
  TrackPlayer.addEventListener(Event.RemoteSeek, event =>
    TrackPlayer.seekTo(event.position),
  );
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, () => {
    const deadline = getAudioSleepDeadline();
    if (deadline && deadline <= Date.now()) {
      clearAudioSleepDeadline();
      void TrackPlayer.pause();
    }
  });
}
