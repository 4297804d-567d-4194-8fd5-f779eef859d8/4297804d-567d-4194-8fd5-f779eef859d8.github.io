import{s as e,l as r,e as a,p as o,i as n}from"./vidstack-ClmE_LDk.js";import{b as c}from"./vidstack-DB4QmL2O.js";class h{#t;src=e("");referrerPolicy=null;get iframe(){return this.#t}constructor(t){this.#t=t,t.setAttribute("frameBorder","0"),t.setAttribute("aria-hidden","true"),t.setAttribute("allow","autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"),this.referrerPolicy!==null&&t.setAttribute("referrerpolicy",this.referrerPolicy)}setup(){r(window,"message",this.#i.bind(this)),r(this.#t,"load",this.onLoad.bind(this)),a(this.#s.bind(this))}#s(){const t=this.src();if(!t.length){this.#t.setAttribute("src","");return}const s=o(()=>this.buildParams());this.#t.setAttribute("src",c(t,s))}postMessage(t,s){this.#t.contentWindow?.postMessage(JSON.stringify(t),s??"*")}#i(t){const s=this.getOrigin();if((t.source===null||t.source===this.#t?.contentWindow)&&(!n(s)||s===t.origin)){try{const i=JSON.parse(t.data);i&&this.onMessage(i,t);return}catch{}t.data&&this.onMessage(t.data,t)}}}export{h as E};