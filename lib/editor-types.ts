export type OverlayType = 'text'|'image'|'signature'|'highlight';
export type Overlay = {
  id:string;
  type:OverlayType;
  pageId:string;
  x:number; y:number; w:number; h:number;
  text?:string;
  fontSize?:number;
  color?:string;
  dataUrl?:string;
  opacity?:number;
};
export type EditorPage = { id:string; sourceIndex:number; rotation:number };
