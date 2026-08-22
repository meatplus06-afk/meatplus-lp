import fs from 'node:fs/promises';

const target = 'scripts/auto-publish.mjs';
let source = await fs.readFile(target, 'utf8');

const oldCopy = "  const catchCopy=text(p.catchCopy)||name, closing=text(p.closingCopy)||catchCopy;";
const newCopy = "  const catchCopy=text(p.catchCopy)||name, closing=text(p.closingCopy)||catchCopy;\n  const sceneCopies={\n    sns1:text(p.sceneCopy1 ?? p.sceneCopies?.sns1 ?? p.sceneCopies?.[0])||catchCopy,\n    sns2:text(p.sceneCopy2 ?? p.sceneCopies?.sns2 ?? p.sceneCopies?.[1])||catchCopy,\n    sns3:text(p.sceneCopy3 ?? p.sceneCopies?.sns3 ?? p.sceneCopies?.[2])||catchCopy\n  };";

const oldStories = "  const stories=['sns1','sns2','sns3'].filter(role=>images[role]).map((role,i)=>`\n<article class=\"story-card ${['story-card-dark','story-card-light','story-card-red'][i]}\"><img data-image-role=\"${role}\" src=\"${img(role)}\" alt=\"${esc(name)}の商品イメージ${i+1}\" width=\"1200\" height=\"1200\" loading=\"lazy\"><div><span>SCENE 0${i+1}</span><h2>${esc(catchCopy)}</h2></div></article>`).join('');";
const newStories = "  const stories=['sns1','sns2','sns3'].filter(role=>images[role]).map((role,i)=>`\n<article class=\"story-card ${['story-card-dark','story-card-light','story-card-red'][i]}\"><img data-image-role=\"${role}\" src=\"${img(role)}\" alt=\"${esc(name)}の商品イメージ${i+1}\" width=\"1200\" height=\"1200\" loading=\"lazy\"><div><span>SCENE 0${i+1}</span><h2>${esc(sceneCopies[role])}</h2></div></article>`).join('');";

if (!source.includes(oldCopy)) throw new Error('scene-copy patch: catchCopy anchor not found');
if (!source.includes(oldStories)) throw new Error('scene-copy patch: stories anchor not found');

source = source.replace(oldCopy, newCopy).replace(oldStories, newStories);
await fs.writeFile(target, source);
console.log('Applied per-scene copy support to auto-publish.mjs');
