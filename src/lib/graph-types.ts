export interface GraphNote {
  id:string;
  title:string;
  type:'paper'|'thought';
  description:string;
  topics:string[];
  tags:string[];
  demo:boolean;
  url:string;
}
export interface GraphLink {source:string;target:string;kind:'link'|'related';}
export interface NoteGraph {nodes:GraphNote[];links:GraphLink[];missing:GraphLink[];}
