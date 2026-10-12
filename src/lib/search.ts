export interface SearchEntry { title:string; description:string; tags:string[]; topics:string[]; type:string; demo:boolean; url:string; body:string; }
export function searchEntries(entries: SearchEntry[], query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return entries.map(entry => {
    const title=entry.title.toLocaleLowerCase(), tags=entry.tags.join(' ').toLocaleLowerCase(), body=entry.body.toLocaleLowerCase();
    const haystack=[title,tags,body,entry.description,...entry.topics].join(' ').toLocaleLowerCase();
    const score = words.every(w=>haystack.includes(w)) ? words.reduce((n,w)=>n+(title.includes(w)?8:0)+(tags.includes(w)?4:0)+(body.includes(w)?1:0),0) : 0;
    return {entry,score};
  }).filter(p=>p.score>0).sort((a,b)=>b.score-a.score).map(p=>p.entry);
}
