import fs from 'node:fs/promises';

const target = 'scripts/auto-publish.mjs';
let source = await fs.readFile(target, 'utf8');

const oldCopy = "  const catchCopy=text(p.catchCopy)||name, closing=text(p.closingCopy)||catchCopy;";
const newCopy = "  const catchCopy=text(p.catchCopy)||name, closing=text(p.closingCopy)||catchCopy;\n  const sentenceCandidates=description.split(/(?<=[。！？!?])/u).map(text).filter(Boolean);\n  const scoreSentence=(value,keywords)=>keywords.reduce((score,keyword)=>score+(value.includes(keyword)?1:0),0);\n  const pickStorySentence=(preferred,used,keywords,fallback)=>{\n    const direct=text(preferred);\n    if(direct && !used.includes(direct)) return direct;\n    const ranked=sentenceCandidates\n      .filter(value=>!used.includes(value))\n      .map((value,index)=>({value,index,score:scoreSentence(value,keywords)}))\n      .sort((a,b)=>b.score-a.score||a.index-b.index);\n    if(ranked.length && ranked[0].score>0) return ranked[0].value;\n    const unused=sentenceCandidates.find(value=>!used.includes(value));\n    if(unused) return unused;\n    const safeFallback=text(fallback);\n    return safeFallback && !used.includes(safeFallback) ? safeFallback : name;\n  };\n  const scene1=text(p.sceneCopy1 ?? p.scene1Copy ?? p.sns1Copy ?? p.appealCopy1 ?? p.sceneCopies?.sns1 ?? p.sceneCopies?.[0])||catchCopy;\n  const scene2=pickStorySentence(\n    p.sceneCopy2 ?? p.scene2Copy ?? p.sns2Copy ?? p.appealCopy2 ?? p.sceneCopies?.sns2 ?? p.sceneCopies?.[1],\n    [scene1],\n    ['味','旨み','うまみ','コク','香り','風味','食感','やわらか','柔らか','ジューシー','濃厚','まろやか','甘み','辛み','素材','厳選','国産','九州産','黒毛和牛','製法','仕上げ','品質','鮮度','味噌','醤油','にんにく','昆布','かつお'],\n    closing\n  );\n  const scene3=pickStorySentence(\n    p.sceneCopy3 ?? p.scene3Copy ?? p.sns3Copy ?? p.appealCopy3 ?? p.sceneCopies?.sns3 ?? p.sceneCopies?.[2],\n    [scene1,scene2],\n    ['簡単','手軽','調理','温め','焼くだけ','煮るだけ','希釈','水で','食卓','家族','ご家庭','ごちそう','おかず','おつまみ','ストック','保存','常温','冷凍','〆','しめ','ちゃんぽん','雑炊','アレンジ','贈り物','ギフト','ご褒美','楽しめ'],\n    meta\n  );\n  const sceneCopies={sns1:scene1,sns2:scene2,sns3:scene3};";

const oldStories = "  const stories=['sns1','sns2','sns3'].filter(role=>images[role]).map((role,i)=>`\n<article class=\"story-card ${['story-card-dark','story-card-light','story-card-red'][i]}\"><img data-image-role=\"${role}\" src=\"${img(role)}\" alt=\"${esc(name)}の商品イメージ${i+1}\" width=\"1200\" height=\"1200\" loading=\"lazy\"><div><span>SCENE 0${i+1}</span><h2>${esc(catchCopy)}</h2></div></article>`).join('');";
const newStories = "  const stories=['sns1','sns2','sns3'].filter(role=>images[role]).map((role,i)=>`\n<article class=\"story-card ${['story-card-dark','story-card-light','story-card-red'][i]}\"><img data-image-role=\"${role}\" src=\"${img(role)}\" alt=\"${esc(name)}の商品イメージ${i+1}\" width=\"1200\" height=\"1200\" loading=\"lazy\"><div><span>SCENE 0${i+1}</span><h2>${esc(sceneCopies[role])}</h2></div></article>`).join('');";

if (!source.includes(oldCopy)) throw new Error('scene-copy patch: catchCopy anchor not found');
if (!source.includes(oldStories)) throw new Error('scene-copy patch: stories anchor not found');

source = source.replace(oldCopy, newCopy).replace(oldStories, newStories);
await fs.writeFile(target, source);
console.log('Applied sales-story scene copy support to auto-publish.mjs');
