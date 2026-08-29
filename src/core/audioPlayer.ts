import TrackPlayer, {
  AndroidAudioContentType,
  Capability,
} from 'react-native-track-player';

let setup: Promise<void> | undefined;

export function ensureAudioPlayer() {
  if (!setup)
    setup = TrackPlayer.setupPlayer({
      androidAudioContentType: AndroidAudioContentType.Speech,
      autoHandleInterruptions: true,
      autoUpdateMetadata: true,
      minBuffer: 10,
      maxBuffer: 50,
      playBuffer: 2,
      backBuffer: 30,
    })
      .catch(error => {
        if (!String(error).toLowerCase().includes('already')) throw error;
      })
      .then(() =>
        TrackPlayer.updateOptions({
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.Stop,
            Capability.SeekTo,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.JumpForward,
            Capability.JumpBackward,
          ],
          notificationCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.JumpForward,
            Capability.JumpBackward,
          ],
          forwardJumpInterval: 15,
          backwardJumpInterval: 15,
          progressUpdateEventInterval: 1,
        }),
      );
  return setup;
}
