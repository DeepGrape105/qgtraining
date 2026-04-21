export const getClosestHandle = (
  mouseX: number, mouseY: number,
  nodeX: number, nodeY: number,
  nodeWidth: number, nodeHeight: number
): string | null => {
  const handles = [
    { id: 'top', x: nodeX + nodeWidth / 2, y: nodeY },
    { id: 'bottom', x: nodeX + nodeWidth / 2, y: nodeY + nodeHeight },
    { id: 'left', x: nodeX, y: nodeY + nodeHeight / 2 },
    { id: 'right', x: nodeX + nodeWidth, y: nodeY + nodeHeight / 2 },
  ];

  let closest = null;
  let minDist = Infinity;

  for (const handle of handles) {
    const dx = mouseX - handle.x;
    const dy = mouseY - handle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      closest = handle.id;
    }
  }
  return closest;
};