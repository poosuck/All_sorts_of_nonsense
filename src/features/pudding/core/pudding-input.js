// Generated from supplied v24 source. Edit scripts/sync-pudding-source.mjs; run npm run source:sync.
export function canStartPointer(e, held) {
    return !held && e.isPrimary && e.button === 0 && ["mouse", "touch", "pen"].includes(e.pointerType);
}
export function isActivePointer(e, activeId) {
    return activeId !== null && e.pointerId === activeId;
}
