// One active contact prevents a second finger from moving or releasing the grab.
type Pointer = { pointerId: number; pointerType: string; button: number; isPrimary: boolean };
export function canStartPointer(e: Pointer, held: boolean) {
  return !held && e.isPrimary && e.button === 0 && ["mouse", "touch", "pen"].includes(e.pointerType);
}
export function isActivePointer(e: Pick<Pointer, "pointerId">, activeId: number | null) {
  return activeId !== null && e.pointerId === activeId;
}
