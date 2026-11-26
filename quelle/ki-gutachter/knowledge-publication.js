// Publication policy for the knowledge supplied to the public assistant.
// Private source documents and material/calculation inputs are not rewritten.
export const PUBLIC_KNOWLEDGE_VERSION='public-examples-v1';

const WARM_FORMING_EXAMPLE='- K32 Modellbetrachtung Warmumformen: Titan (Reintitan) bei beispielhaft 700 °C Werkstücktemperatur. Dies ist ein konstruiertes Beispiel für die Verfahrensplanung. Vorwärmung, Temperaturmessung, temperaturgeeignete Schmierung, Schutz der Oberfläche sowie thermische Trennung und Kühlung empfindlicher Maschinenbereiche gemeinsam planen. Heizleistung, Einbauort, Stationszahl und Hubzahl aus dem konkreten Teil und dem Temperaturverlauf ableiten. Dieser Beispielwert ist weder Materialfreigabe noch Kraftmodell oder belegter Referenzauftrag.';

function cardKey(line){
 return line.match(/^\s*(?:(?:[-*+]\s+|#{1,6}\s+|\|\s*))?(?:\*\*|__)?([KRW]\d+)(?![\p{L}\p{N}_])/u)?.[1]||null;
}

export function projectPublicKnowledge(raw){
 const out=[];let replacing=false,inserted=false,fence=null;
 for(const line of String(raw||'').split(/\r?\n/)){
  const fenced=line.match(/^\s*(`{3,}|~{3,})/);
  // Card continuations may contain code/quoted source fragments. A heading
  // inside a fenced fragment is not a safe boundary for the private card.
  if(replacing&&fence){if(fenced&&fenced[1][0]===fence[0]&&fenced[1].length>=fence.length)fence=null;continue;}
  const key=cardKey(line);
  if(key==='K32'){
   if(!inserted){out.push(WARM_FORMING_EXAMPLE);inserted=true;}
   replacing=true;continue;
  }
  if(replacing){
   if(fenced){fence=fenced[1];continue;}
   if(!key&&!/^\s*#{1,6}\s+/.test(line))continue;
   replacing=false;
  }
  out.push(line);
 }
 return out.join('\n');
}
