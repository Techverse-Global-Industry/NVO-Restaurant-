import {readFileSync,writeFileSync} from "node:fs";
const css=readFileSync("public/fonts/source.css","utf8");
const blocks=[...css.matchAll(/\/\* (latin(?:-ext)?) \*\/\s*(@font-face\s*\{[^}]+\})/g)];
const output=[];
for(let i=0;i<blocks.length;i++){
  const block=blocks[i][2], url=block.match(/url\(([^)]+)\)/)[1];
  const name=`nvo-font-${i}.woff2`;const r=await fetch(url);if(!r.ok)throw new Error(`Font download ${r.status}`);
  writeFileSync(`public/fonts/${name}`,Buffer.from(await r.arrayBuffer()));
  output.push(block.replace(url,`/fonts/${name}`));
}
writeFileSync("app/fonts.css",output.join("\n"));
for(const name of ["dmsans","playfairdisplay"]){const r=await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${name}/OFL.txt`);if(!r.ok)throw new Error(`License ${r.status}`);writeFileSync(`public/fonts/${name}-OFL.txt`,await r.text());}
console.log(`${blocks.length} self-hosted font subsets installed with licenses.`);
