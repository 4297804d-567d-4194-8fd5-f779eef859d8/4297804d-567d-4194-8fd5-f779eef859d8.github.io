import{a as f,H as r}from"./vidstack-ClmE_LDk.js";class u{#t;get length(){return this.#t.length}constructor(t,e){f(t)?this.#t=t:!r(t)&&!r(e)?this.#t=[[t,e]]:this.#t=[]}start(t){return this.#t[t][0]??1/0}end(t){return this.#t[t][1]??1/0}}function h(n){if(!n.length)return null;let t=n.start(0);for(let e=1;e<n.length;e++){const s=n.start(e);s<t&&(t=s)}return t}function o(n){if(!n.length)return null;let t=n.end(0);for(let e=1;e<n.length;e++){const s=n.end(e);s>t&&(t=s)}return t}function l(n){if(n.length<=1)return n;n.sort((s,i)=>s[0]-i[0]);let t=[],e=n[0];for(let s=1;s<n.length;s++){const i=n[s];e[1]>=i[0]-1?e=[e[0],Math.max(e[1],i[1])]:(t.push(e),e=i)}return t.push(e),t}function m(n,t,e){let s=t[0],i=t[1];return e<s?[e,-1]:e===s?t:s===-1?(t[0]=e,t):(e>s&&(t[1]=e,i===-1&&n.push(t)),l(n),t)}export{u as T,o as a,h as g,m as u};