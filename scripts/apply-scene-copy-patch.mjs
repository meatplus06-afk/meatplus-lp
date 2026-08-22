import fs from 'node:fs/promises';

const target = 'scripts/auto-publish.mjs';
let source = await fs.readFile(target, 'utf8');

const oldCopy = "  const catchCopy=text(p.catchCopy)||name, closing=text(p.closingCopy)||catchCopy;";
const newCopy = "  const catchCopy=text(p.catchCopy)||name, closing=text(p.closingCopy)||catchCopy;\n  const sentenceCandidates=description.split(/(?<=[。！？!?])/u).map(text).filter(Boolean);\n  const pickDifferent=(preferred, used, fallback)=>{\n    const direct=text(preferred);\n    if(direct && !used.includes(direct)) return direct;\n    const fromDescription=sentenceCandidates.find(value=>!used.includes(value));\n    if(fromDescription) return fromDescription;\n    const safeFallback=text(fallback);\n    return safeFallback && !used.includes(safeFallback) ? safeFallback : name;\n  };\n  const scene1=text(p.sceneCopy1 ?? p.scene1Copy ?? p.sns1Copy ?? p.appealCopy1 ?? p.sceneCopies?.sns1 ?? p.sceneCopies?.[0])||catchCopy;\n  const scene2=pickDifferent(p.sceneCopy2 ?? p.scene2Copy ?? p.sns2Copy ?? p.appealCopy2 ?? p.sceneCopies?.sns2 ?? p.sceneCopies?.[1] ?? closing,[scene1],name+'を、いつもの食卓に。');\n  const scene3=pickDifferent(p.sceneCopy3 ?? p.scene3Copy ?? p.sns3Copy ?? p.appealCopy3 ?? p.sceneCopies?.sns3 ?? p.sceneCopies?.[2] ?? meta,[scene1,scene2],name+'の魅力を、写真とともにご紹介。');\n  const sceneCopies={sns1:scene1,sns2:scene2,sns3:scene3};";

const oldStories = "  const stories=['sns1','sns2','sns3'].filter(role=>images[role]).map((role,i)=>`\n<article class=\"story-card ${['story-card-dark','story-card-light','story-card-red'][i]}\"><img data-image-role=\"${role}\" src=\"${img(role)}\" alt=\"${esc(name)}の商品イメージ${i+1}\" width=\"1200\" height=\"1200\" loading=\"lazy\"><div><span>SCENE 0${i+1}</span><h2>${esc(catchCopy)}</h2></div></article>`).join('');";
const newStories = "  const stories=['sns1','sns2','sns3'].filter(role=>images[role]).map((role,i)=>`\n<article class=\"story-card ${['story-card-dark','story-card-light','story-card-red'][i]}\"><img data-image-role=\"${role}\" src=\"${img(role)}\" alt=\"${esc(name)}の商品イメージ${i+1}\" width=\"1200\" height=\"1200\" loading=\"lazy\"><div><span>SCENE 0${i+1}</span><h2>${esc(sceneCopies[role])}</h2></div></article>`).join('');";

if (!source.includes(oldCopy)) throw new Error('scene-copy patch: catchCopy anchor not found');
if (!source.includes(oldStories)) throw new Error('scene-copy patch: stories anchor not found');

source = source.replace(oldCopy, newCopy).replace(oldStories, newStories);
await fs.writeFile(target, source);
console.log('Applied per-scene copy support to auto-publish.mjs');
