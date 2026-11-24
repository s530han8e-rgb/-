'use strict';
const rooms = [
  {id:'about', name:'关于我', x:634, y:467, objects:[['关于我的手记','about',550]]},
  {id:'projects', name:'文化项目', x:750, y:467, objects:[['女书研究手记','project0',350],['兴安盟草原文化研究','project1',690]]},
  {id:'experience', name:'实习经历', x:875, y:467, objects:[['实习时间线','experience',668]]},
  {id:'notes', name:'随笔', x:629, y:845, objects:[['一条陌生的信息','note0',215],['救赎','note1',396],['禁闭','note2',593],['女书研究手记','note3',796]]},
  {id:'ai', name:'AI 项目', x:721, y:845, objects:[['每日一签','ai0',158],['抖音漫剧','ai1',329],['工作台','ai2',500],['首席执星官','ai3',671],['东区仍在开放','ai4',842]]},
  {id:'contact', name:'联系', x:878, y:845, objects:[['邮箱','contact',654]]},
];
const stage=document.querySelector('#stage');
const targets=document.querySelector('#targets');
const avatar=document.querySelector('#avatar');
const reader=document.querySelector('#reader');
const copy=document.querySelector('#copy');
const hint=document.querySelector('#hint');
const place=document.querySelector('#place');
const interactButton=document.querySelector('#pad [data-key=Enter]');
const quick=document.querySelector('#quick');
const leave=document.querySelector('#leave');
const keys=new Set();
const arrows=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
const floor=851, balcony=456, ladder=529, roomFloor=946;
const platforms=[[252,345,747],[386,488,678],[542,972,balcony],[15,986,floor]];
const instructions='← → 走动　空格跳跃　↑ ↓ 爬梯　Enter 交互';
let room=null, x=103, y=floor, vy=0, facing='right', grounded=true, climbing=false, time=0, currentAvatar='', positionBeforeRoom=null;
let buttons=[], returnFocus=null, interactionHintUntil=0;

function element(tag,text,cls){
  const node=document.createElement(tag);
  node.textContent=text;
  if(cls)node.className=cls;
  return node;
}
function button(text,handler,cls){
  const node=element('button',text,cls);
  node.type='button';
  node.addEventListener('click',handler);
  return node;
}
function openCopy(id,trigger){
  const template=document.getElementById('copy-'+id);
  if(!template || reader.open)return;
  keys.clear();
  returnFocus=trigger??stage;
  copy.replaceChildren(template.content.cloneNode(true));
  copy.querySelector('h2').id='reader-title';
  const play=copy.querySelector('#load-daily-draw');
  if(play)play.addEventListener('click',()=>loadDailyDraw(play));
  reader.showModal();
  reader.scrollTop=0;
}
let dailyDrawURL;
async function loadDailyDraw(button){
  const status=copy.querySelector('#daily-draw-status');
  const video=copy.querySelector('video');
  button.disabled=true;
  status.textContent='正在加载视频…';
  try{
    if(!dailyDrawURL){
      const parts=await Promise.all(Array.from({length:12},async(_,index)=>{
        const response=await fetch(`media/daily-draw-${index}.bin`);
        if(!response.ok)throw new Error('Video segment could not be loaded');
        return response.arrayBuffer();
      }));
      dailyDrawURL=URL.createObjectURL(new Blob(parts,{type:'video/mp4'}));
    }
    if(!reader.open || !video.isConnected)return;
    video.src=dailyDrawURL;
    video.hidden=false;
    button.hidden=true;
    status.textContent='';
    await video.play().catch(()=>{});
  }catch{
    status.textContent='视频暂时无法加载，请重试。';
    button.disabled=false;
  }
}
reader.addEventListener('close',()=>{
  keys.clear();
  copy.querySelectorAll('video').forEach(video=>video.pause());
  returnFocus?.focus({preventScroll:true});
});
function mapTargets(){
  targets.replaceChildren();
  quick.replaceChildren();
  quick.hidden=!room;
  const items=room?room.objects.map(([name,id,px])=>({name,id,x:px,y:690})):rooms;
  buttons=items.map(item=>{
    const activate=e=>room?openCopy(item.id,e.currentTarget):go(item.id);
    const itemButton=button(item.name,activate,'target');
    itemButton.style.left=item.x/10+'%';
    itemButton.style.top=(item.y-(room?110:60))/10+'%';
    targets.append(itemButton);
    if(room)quick.append(button(item.name,activate));
    return {item,node:itemButton};
  });
}
function loadRoom(id){
  if(room?.id===id || (!room && !id))return;
  if(id){
    if(!room)positionBeforeRoom={x,y};
    room=rooms.find(item=>item.id===id);
    x=96;y=roomFloor;
  }else if(positionBeforeRoom){
    ({x,y}=positionBeforeRoom);
    room=null;
  }
  keys.clear();vy=0;climbing=false;grounded=true;interactionHintUntil=0;
  stage.dataset.scene=room?'room':'world';
  stage.setAttribute('aria-label',room?room.name+'房间':'横版探索场景');
  leave.hidden=!room;
  place.textContent=room?.name??'屋外';
  mapTargets();paint(false);
}
function handleHash(){
  const hash=location.hash.slice(1);
  loadRoom(rooms.find(item=>'room-'+item.id===hash)?.id);
}
function go(id){
  const hash=id?'#room-'+id:'#world';
  if(location.hash!==hash)history.pushState(null,'',hash);
  handleHash();
  stage.focus({preventScroll:true});
}
window.addEventListener('hashchange',handleHash);
window.addEventListener('popstate',handleHash);
const nav=document.querySelector('#nav');
for(const item of rooms){
  const link=element('a',item.name);
  link.href='#room-'+item.id;
  nav.append(link);
}
document.querySelector('#start').addEventListener('click',()=>go(null));
leave.addEventListener('click',()=>go(null));

function nearby(){
  let best=null,distance=room?65:51;
  for(const entry of buttons){
    const dx=Math.abs(x-entry.item.x);
    if(dx<distance && (room || Math.abs(y-entry.item.y)<48)){
      best=entry;distance=dx;
    }
  }
  return best;
}
function interact(){
  const next=nearby();
  if(!next){
    interactionHintUntil=performance.now()+2400;
    paint(false);
    return;
  }
  if(room)openCopy(next.item.id);
  else go(next.item.id);
}
function paint(moving){
  const next=nearby();
  for(const entry of buttons)entry.node.toggleAttribute('data-near',entry===next);
  interactButton.toggleAttribute('data-ready',!!next);
  const moveCloser=performance.now()<interactionHintUntil;
  const text=next
    ? `按 Enter 或点「互动」${room?'查看':'进入'}「${next.item.name}」`
    : moveCloser
      ? (room?'先走到物件旁，再点「互动」。':'先走到门口，再点「互动」。')
      : room?'走到物件旁，按 Enter 或点「互动」。':instructions;
  if(hint.textContent!==text)hint.textContent=text;
  avatar.style.left=x/10+'%';
  avatar.style.top=y/10+'%';
  avatar.classList.toggle('walk',moving);
  const path=moving?`media/${facing}-${Math.floor(time/90)%8}.webp`:'media/mianmian.png';
  if(path!==currentAvatar){avatar.src=path;currentAvatar=path;}
}
function step(dt){
  if(reader.open)return;
  const horizontal=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
  const vertical=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));
  if(horizontal)facing=horizontal>0?'right':'left';
  if(room){
    x=Math.min(946,Math.max(45,x+horizontal*dt*.37));
    if(!grounded){
      vy+=dt*.006;
      y+=vy*dt;
      if(y>=roomFloor){y=roomFloor;vy=0;grounded=true;}
    }
  }else{
    if(vertical && Math.abs(x-ladder)<27 && (climbing || y>=balcony-8)){
      climbing=true;grounded=false;vy=0;x=ladder;
      y=Math.min(floor,Math.max(balcony,y+vertical*dt*.73));
      if(y===floor || y===balcony){climbing=false;grounded=true;}
    }else if(!climbing || horizontal && (y===balcony || y===floor)){
      climbing=false;
      const previousY=y;
      const previousX=x;
      x=Math.min(974,Math.max(26,x+horizontal*dt*.38));
      if(grounded && !platforms.some(([lo,hi,h])=>y===h && x>=lo && x<=hi)){
        const atLadderTop=y===balcony && Math.abs(x-ladder)<=27;
        if(!atLadderTop)grounded=false;
      }
      if(y===balcony && horizontal && previousX>=542 && x<542 && x>=ladder-10)grounded=true;
      if(!grounded){
        vy+=dt*.006;
        y+=vy*dt;
        for(const [lo,hi,h] of platforms){
          if(vy>=0 && previousY<=h && y>=h && x>=lo && x<=hi){
            y=h;vy=0;grounded=true;break;
          }
        }
        if(y>floor){y=floor;vy=0;grounded=true;}
      }
    }
  }
  const moving=!!horizontal&&!climbing;
  if(moving)time+=dt;
  paint(moving);
}
function press(key){
  if(reader.open)return;
  if(key==='Enter'){interact();return;}
  if(key==='Space'){
    if(grounded && !climbing){vy=room?-1.25:-1.69;grounded=false;y-=1;paint(false);}
    return;
  }
  keys.add(key);
}
window.addEventListener('keydown',e=>{
  if(reader.open || ![...arrows,'Enter','Space'].includes(e.code))return;
  if(['Enter','Space'].includes(e.code) && e.target.closest?.('a,button'))return;
  e.preventDefault();
  if(arrows.includes(e.code) && e.target!==stage)stage.focus({preventScroll:true});
  if(!e.repeat)press(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>keys.clear());
document.querySelectorAll('#pad button').forEach(node=>{
  const key=node.dataset.key;
  if(!arrows.includes(key)){
    node.addEventListener('click',()=>{
      stage.focus({preventScroll:true});
      press(key);
    });
    return;
  }
  node.addEventListener('pointerdown',e=>{e.preventDefault();node.setPointerCapture(e.pointerId);press(key);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(event,()=>keys.delete(key));
  node.addEventListener('click',e=>{
    if(e.detail===0){press(key);step(64);keys.delete(key);}
  });
});
let last=performance.now(),manual=false;
function frame(now){
  if(!manual)step(Math.min(24,now-last));
  last=now;requestAnimationFrame(frame);
}
window.advanceTime=ms=>{manual=true;while(ms>0){const dt=Math.min(ms,10);step(dt);ms-=dt;}};
window.render_game_to_text=()=>JSON.stringify({room:room?.id??null,x:Math.round(x),y:Math.round(y),grounded,near:nearby()?.item.id??null,reader:reader.open});
mapTargets();handleHash();paint(false);requestAnimationFrame(frame);
