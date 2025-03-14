import { MenuItem } from "../components/chart/context-menu";

export interface ShowContextMenuEvent extends CustomEvent {
  detail: {
    position: { x: number; y: number };
    items: MenuItem[];
  };
}
