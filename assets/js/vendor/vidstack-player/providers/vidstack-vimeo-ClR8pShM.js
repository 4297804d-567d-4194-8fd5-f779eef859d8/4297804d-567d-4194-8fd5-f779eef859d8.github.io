import{ak as y,s as u,e as c,p as l,i as b,h as d,l as k,a as m}from"../chunks/vidstack-ClmE_LDk.js";import{Q as f}from"../chunks/vidstack-DRH_1tFW.js";import{T as a}from"../chunks/vidstack-BFul-1yb.js";import{a as v}from"../chunks/vidstack-BqbADcDA.js";import{L as r}from"../chunks/vidstack-C_AxqLKV.js";import{R as w}from"../chunks/vidstack-B282tuhq.js";import{p as P}from"../chunks/vidstack-DB4QmL2O.js";import{E as T}from"../chunks/vidstack-Bi_GX7qv.js";import{resolveVimeoVideoId as C,getVimeoVideoInfo as g}from"../chunks/vidstack-2f5gzOW6.js";import"../chunks/vidstack-tiQh4UD3.js";const $=["bufferend","bufferstart","durationchange","ended","enterpictureinpicture","error","fullscreenchange","leavepictureinpicture","loaded","playProgress","loadProgress","pause","play","playbackratechange","qualitychange","seeked","seeking","timeupdate","volumechange","waiting"];class E extends T{$$PROVIDER_TYPE="VIMEO";scope=y();fullscreen;#e;#s=u("");#i=u(!1);#a=null;#c=null;#d=!1;#n=new a(0,0);#l=new w(this.#g.bind(this));#w=null;#r=null;#o=new Map;#u=null;constructor(e,t){super(e),this.#e=t;const s=this;this.fullscreen={get active(){return s.#d},supported:!0,enter:()=>this.#t("requestFullscreen"),exit:()=>this.#t("exitFullscreen")}}cookies=!1;title=!0;byline=!0;portrait=!0;color="00ADEF";get type(){return"vimeo"}get currentSrc(){return this.#c}get videoId(){return this.#s()}get hash(){return this.#a}get isPro(){return this.#i()}preconnect(){P(this.getOrigin())}setup(){super.setup(),c(this.#P.bind(this)),c(this.#T.bind(this)),c(this.#C.bind(this)),this.#e.notify("provider-setup",this)}destroy(){this.#m(),this.fullscreen=void 0;const e="provider destroyed";for(const t of this.#o.values())for(const{reject:s}of t)s(e);this.#o.clear(),this.#t("destroy")}async play(){return this.#t("play")}async pause(){return this.#t("pause")}setMuted(e){this.#t("setMuted",e)}setCurrentTime(e){this.#t("seekTo",e),this.#e.notify("seeking",e)}setVolume(e){this.#t("setVolume",e),this.#t("setMuted",l(this.#e.$state.muted))}setPlaybackRate(e){this.#t("setPlaybackRate",e)}async loadSource(e){if(!b(e.src)){this.#c=null,this.#a=null,this.#s.set("");return}const{videoId:t,hash:s}=C(e.src);this.#s.set(t??""),this.#a=s??null,this.#c=e}#P(){this.#m();const e=this.#s();if(!e){this.src.set("");return}this.src.set(`${this.getOrigin()}/video/${e}`),this.#e.notify("load-start")}#T(){const e=this.#s();if(!e)return;const t=d(),s=new AbortController;return this.#u=t,g(e,s,this.#a).then(i=>{t.resolve(i)}).catch(i=>{t.reject()}),()=>{t.reject(),s.abort()}}#C(){const e=this.#i(),{$state:t,qualities:s}=this.#e;if(t.canSetPlaybackRate.set(e),s[r.setReadonly](!e),e)return k(s,"change",()=>{if(s.auto)return;const i=s.selected?.id;i&&this.#t("setQuality",i)})}getOrigin(){return"https://player.vimeo.com"}buildParams(){const{keyDisabled:e}=this.#e.$props,{playsInline:t,nativeControls:s}=this.#e.$state,i=s();return{title:this.title,byline:this.byline,color:this.color,portrait:this.portrait,controls:i,h:this.hash,keyboard:i&&!e(),transparent:!0,playsinline:t(),dnt:!this.cookies}}#g(){this.#t("getCurrentTime")}#h=!1;#$(e,t){if(this.#h&&e===0)return;const{realCurrentTime:s,paused:i,bufferedEnd:n,seekableEnd:o,live:h}=this.#e.$state;if(s()===e)return;const p=s();this.#e.notify("time-change",e,t),Math.abs(p-e)>1.5&&(this.#e.notify("seeking",e,t),!i()&&n()<e&&this.#e.notify("waiting",void 0,t)),!h()&&o()-e<.01&&(this.#e.notify("end",void 0,t),this.#h=!0,setTimeout(()=>{this.#h=!1},500))}#E(e,t){this.#e.notify("seeked",e,t)}#V(e){const t=this.#s();this.#u?.promise.then(s=>{if(!s)return;const{title:i,poster:n,duration:o,pro:h}=s;this.#i.set(h),this.#e.notify("title-change",i,e),this.#e.notify("poster-change",n,e),this.#e.notify("duration-change",o,e),this.#f(o,e)}).catch(()=>{t===this.#s()&&(this.#t("getVideoTitle"),this.#t("getDuration"))})}#f(e,t){const{nativeControls:s}=this.#e.$state,i=s();this.#n=new a(0,e);const n={buffered:new a(0,0),seekable:this.#n,duration:e};this.#e.delegate.ready(n,t),i||this.#t("_hideOverlay"),this.#t("getQualities"),this.#t("getChapters")}#I(e,t,s){switch(e){case"getVideoTitle":const i=t;this.#e.notify("title-change",i,s);break;case"getDuration":const n=t;this.#e.$state.canPlay()?this.#e.notify("duration-change",n,s):this.#f(n,s);break;case"getCurrentTime":this.#$(t,s);break;case"getBuffered":m(t)&&t.length&&this.#p(t[t.length-1][1],s);break;case"setMuted":this.#y(l(this.#e.$state.volume),t,s);break;case"getChapters":this.#L(t);break;case"getQualities":this.#F(t,s);break}this.#v(e)?.resolve()}#R(){for(const e of $)this.#t("addEventListener",e)}#A(e){this.#l.stop(),this.#e.notify("pause",void 0,e)}#M(e){this.#l.start(),this.#e.notify("play",void 0,e)}#S(e){const{paused:t}=this.#e.$state;!t()&&!this.#h&&this.#e.notify("playing",void 0,e)}#p(e,t){const s={buffered:new a(0,e),seekable:this.#n};this.#e.notify("progress",s,t)}#q(e){this.#e.notify("waiting",void 0,e)}#x(e){const{paused:t}=this.#e.$state;t()||this.#e.notify("playing",void 0,e)}#Q(e){const{paused:t}=this.#e.$state;t()&&this.#e.notify("play",void 0,e),this.#e.notify("waiting",void 0,e)}#y(e,t,s){const i={volume:e,muted:t};this.#e.notify("volume-change",i,s)}#L(e){if(this.#b(),!e.length)return;const t=new v({kind:"chapters",default:!0}),{seekableEnd:s}=this.#e.$state;for(let i=0;i<e.length;i++){const n=e[i],o=e[i+1];t.addCue(new window.VTTCue(n.startTime,o?.startTime??s(),n.title))}this.#r=t,this.#e.textTracks.add(t)}#b(){this.#r&&(this.#e.textTracks.remove(this.#r),this.#r=null)}#F(e,t){this.#e.qualities[f.enableAuto]=e.some(s=>s.id==="auto")?()=>this.#t("setQuality","auto"):void 0;for(const s of e){if(s.id==="auto")continue;const i=+s.id.slice(0,-1);isNaN(i)||this.#e.qualities[r.add]({id:s.id,width:i*(16/9),height:i,codec:"avc1,h.264",bitrate:-1},t)}this.#k(e.find(s=>s.active),t)}#k({id:e}={},t){if(!e)return;const s=e==="auto",i=this.#e.qualities.getById(e);s?(this.#e.qualities[f.setAuto](s,t),this.#e.qualities[r.select](void 0,!0,t)):this.#e.qualities[r.select](i??void 0,!0,t)}#O(e,t,s){switch(e){case"ready":this.#R();break;case"loaded":this.#V(s);break;case"play":this.#M(s);break;case"playProgress":this.#S(s);break;case"pause":this.#A(s);break;case"loadProgress":this.#p(t.seconds,s);break;case"waiting":this.#Q(s);break;case"bufferstart":this.#q(s);break;case"bufferend":this.#x(s);break;case"volumechange":this.#y(t.volume,l(this.#e.$state.muted),s);break;case"durationchange":this.#n=new a(0,t.duration),this.#e.notify("duration-change",t.duration,s);break;case"playbackratechange":this.#e.notify("rate-change",t.playbackRate,s);break;case"qualitychange":this.#k(t,s);break;case"fullscreenchange":this.#d=t.fullscreen,this.#e.notify("fullscreen-change",t.fullscreen,s);break;case"enterpictureinpicture":this.#e.notify("picture-in-picture-change",!0,s);break;case"leavepictureinpicture":this.#e.notify("picture-in-picture-change",!1,s);break;case"ended":this.#e.notify("end",void 0,s);break;case"error":this.#D(t,s);break;case"seek":case"seeked":this.#E(t.seconds,s);break}}#D(e,t){const{message:s,method:i}=e;i==="setPlaybackRate"&&this.#i.set(!1),i&&this.#v(i)?.reject(s)}onMessage(e,t){e.event?this.#O(e.event,e.data,t):e.method&&this.#I(e.method,e.value,t)}onLoad(){}async#t(e,t){let s=d(),i=this.#o.get(e);return i||this.#o.set(e,i=[]),i.push(s),this.postMessage({method:e,value:t}),s.promise}#m(){this.#l.stop(),this.#n=new a(0,0),this.#u=null,this.#w=null,this.#i.set(!1),this.#b()}#v(e){return this.#o.get(e)?.shift()}}export{E as VimeoProvider};