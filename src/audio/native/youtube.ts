import { YouTubePort, type YouTubeEvents, type YouTubePlayerApi } from '../youtubePort.ts';
interface YouTubeNamespace { Player: new (element: HTMLElement, options: { events: YouTubeEvents }) => YouTubePlayerApi }
type YouTubeWindow = Window & { YT?: YouTubeNamespace; onYouTubeIframeAPIReady?: () => void; __mnxYouTubeApi?: Promise<YouTubeNamespace> };
/** One lazy loader per window, including multiple independently bundled embeds. */
export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  const host=window as YouTubeWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (host.__mnxYouTubeApi) return host.__mnxYouTubeApi;
  const promise=new Promise<YouTubeNamespace>((resolve,reject)=>{
    const previous=host.onYouTubeIframeAPIReady;
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';
    const finish=(error?: Error)=>{
      clearTimeout(timeout);clearInterval(poll);script.onerror=null;
      if(host.onYouTubeIframeAPIReady===ready)host.onYouTubeIframeAPIReady=previous;
      if(error){script.remove();reject(error);}else resolve(host.YT!);
    };
    const ready=()=>{try{previous?.();}finally{if(host.YT?.Player)finish();}};
    const timeout=setTimeout(()=>finish(new Error('YouTube API loading timed out. Check the connection and host CSP.')),15000);
    const poll=setInterval(()=>{if(host.YT?.Player)finish();},100);
    host.onYouTubeIframeAPIReady=ready;script.onerror=()=>finish(new Error('YouTube API could not load. Check the connection and host CSP.'));
    document.head.append(script);
  });
  host.__mnxYouTubeApi=promise;
  void promise.catch(()=>{if(host.__mnxYouTubeApi===promise)delete host.__mnxYouTubeApi;});
  return promise;
}
/** Full viewport visibility is deliberately stricter than the autoplay minimum.
 * Native fullscreen moves inside the cross-origin iframe and is handled separately.
 */
export function youtubeVisible(frame: HTMLIFrameElement): boolean { return youtubeHidden(frame)===null; }
/** Why the player does not count as seen, in words a person can act on, or null when it does. */
export function youtubeHidden(frame: HTMLIFrameElement): string|null {
  if(document.hidden)return 'the page is in the background';
  if(!frame.isConnected)return 'the player is not on the page';
  let fullscreen=document.fullscreenElement;
  while(fullscreen?.shadowRoot?.fullscreenElement)fullscreen=fullscreen.shadowRoot.fullscreenElement;
  if(fullscreen===frame)return null;
  const box=frame.getBoundingClientRect(),px=(n: number)=>`${Math.round(n*10)/10}px`;
  if(box.width<200 || box.height<200)return `the video is ${px(box.width)} × ${px(box.height)}, and YouTube needs 200px × 200px`;
  if(box.left<0 || box.top<0 || box.right>innerWidth || box.bottom>innerHeight)
    return `the video runs past the edge of the screen (${px(box.left)}, ${px(box.top)} to ${px(box.right)}, ${px(box.bottom)} in ${innerWidth} × ${innerHeight})`;
  const name=(e: Element)=>e.localName+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/)[0]:'');
  let node: Element|null=frame;
  while(node){const style=getComputedStyle(node);
    if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)<1)return `${name(node)} has display ${style.display}, visibility ${style.visibility}, opacity ${style.opacity}`;
    node=node.assignedSlot ?? node.parentElement ?? (node.getRootNode() instanceof ShadowRoot?(node.getRootNode() as ShadowRoot).host:null);}
  // Descend open shadow roots when hit-testing. This catches our menus, score
  // grips, clipping ancestors and host overlays without reading inside YouTube.
  for(const fx of [.03,.5,.97])for(const fy of [.03,.5,.97]){
    const x=box.left+box.width*fx,y=box.top+box.height*fy;
    let hit: Element|null=document.elementFromPoint(x,y);
    for(let i=0;i<12&&hit?.shadowRoot;i++){const next=hit.shadowRoot.elementFromPoint(x,y);if(!next||next===hit)break;hit=next;}
    if(hit!==frame)return `${hit?name(hit):'nothing'} covers the video at ${Math.round(fx*100)}% across, ${Math.round(fy*100)}% down`;
  }
  return null;
}
/** Owns the visible iframe, visibility hooks and actual-API clock polling. */
export class NativeYouTubePort extends YouTubePort {
  private timer?: ReturnType<typeof setInterval>;
  private carrier?: ReturnType<typeof setInterval>;
  private frame?: HTMLIFrameElement;
  private destroyed=false;
  private readonly visibility=()=>this.sample();
  constructor(videoId: string, mount: () => Promise<HTMLElement>) {
    let owner: NativeYouTubePort;
    super(videoId,async events=>{
      const container=await mount();
      if(owner.destroyed)throw new Error('YouTube selection cancelled.');
      const api=await loadYouTubeApi();
      if(owner.destroyed)throw new Error('YouTube selection cancelled.');
      const frame=document.createElement('iframe');
      frame.title='YouTube video player';frame.width='480';frame.height='270';
      frame.style.cssText='display:block;width:100%;height:100%;border:0;min-width:200px;min-height:200px';
      frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
      const url=new URL(`https://www.youtube.com/embed/${videoId}`);
      for(const [key,value] of Object.entries({enablejsapi:'1',origin:location.origin,playsinline:'1',controls:'1',autoplay:'0',disablekb:'0'}))url.searchParams.set(key,value);
      frame.src=url.href;owner.frame=frame;container.append(frame);
      owner.timer=setInterval(()=>owner.sample(),100);
      owner.carrier=setInterval(()=>owner.carry(),40);
      document.addEventListener('visibilitychange',owner.visibility);document.addEventListener('fullscreenchange',owner.visibility);
      window.addEventListener('pagehide',owner.visibility);
      return new api.Player(frame,{events});
    },()=>!owner.frame?'the player has not loaded':(youtubeHidden(owner.frame)??true),()=>document.hidden);
    owner=this;
  }
  override dispose(){
    if(this.destroyed)return;this.destroyed=true;
    clearInterval(this.timer);clearInterval(this.carrier);document.removeEventListener('visibilitychange',this.visibility);document.removeEventListener('fullscreenchange',this.visibility);window.removeEventListener('pagehide',this.visibility);
    super.dispose();this.frame?.remove();
  }
}
