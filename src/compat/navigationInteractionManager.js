// React Native 0.86's InteractionManager is already a no-op stub. The HTYF
// host's 0.88 runtime removes its getter, while React Navigation 7 still uses
// these two methods around stack transitions.
module.exports = {
  createInteractionHandle() {
    return -1;
  },
  clearInteractionHandle(handle) {
    if (!handle) throw new Error('InteractionManager: Must provide a handle to clear.');
  },
};
