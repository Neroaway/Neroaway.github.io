import { articleHref, wikiParts } from './connections.mjs';
export default function remarkWikiLinks() {
  return tree => {
    function walk(parent) {
      if (['code','inlineCode','link','linkReference','image','imageReference'].includes(parent.type)) return;
      if (!parent.children) return;
      parent.children = parent.children.flatMap(child => {
        if(child.type !== 'text'){walk(child);return [child];}
        const output=[];let position=0;
        for(const match of child.value.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
          const {id,hash,label}=wikiParts(match[1]);
          if(!id || id.split('/').some(part=>!part || part==='.' || part==='..'))continue;
          if(match.index>position)output.push({type:'text',value:child.value.slice(position,match.index)});
          output.push({type:'link',url:articleHref(id,hash),children:[{type:'text',value:label}]});
          position=match.index+match[0].length;
        }
        if(position<child.value.length)output.push({type:'text',value:child.value.slice(position)});
        return output.length ? output : [child];
      });
    }
    walk(tree);
  };
}
