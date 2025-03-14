export function createPortal(element: HTMLElement) {
  const portal = document.createElement("div");
  portal.setAttribute("data-portal", "");
  document.body.appendChild(portal);
  portal.appendChild(element);
  return portal;
}

export function removePortal(portal: HTMLElement) {
  if (portal && portal.parentNode) {
    portal.parentNode.removeChild(portal);
  }
}
