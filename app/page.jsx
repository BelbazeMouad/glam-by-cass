'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import BookingCalendar from './components/BookingCalendar';
import { supabaseBrowser } from '@/lib/supabase';

const PAGES = ['home','about','services','portfolio','book','contact'];
const THUMBS = ['t1','t2','t3','t4','t5','t6'];
// A reel's main media can be an uploaded photo, uploaded video, or an external link.
const isUploaded = (u) => !!u && u.includes('/reels/');
const isImageUrl = (u) => !!u && /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(u);
const FALLBACK_REELS = [
  { id:1, client_name:'Amina', service:'Bridal', look:'Soft glam', dur:'2:14', cls:'t1' },
  { id:2, client_name:'Lina', service:'Photoshoot', look:'Bold editorial', dur:'1:48', cls:'t2' },
  { id:3, client_name:'Sara', service:'Special Occasion', look:'Warm glow', dur:'2:30', cls:'t3' },
  { id:4, client_name:'Yasmine', service:'Special Occasion', look:'Smokey', dur:'1:56', cls:'t4' },
  { id:5, client_name:'Nour', service:'Bridal', look:'Natural', dur:'2:08', cls:'t5' },
  { id:6, client_name:'Rania', service:'Photoshoot', look:'Dewy skin', dur:'1:42', cls:'t6' },
];

export default function Home() {
  const [page, setPage] = useState('home');
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [reels, setReels] = useState(FALLBACK_REELS);
  const [theme, setTheme] = useState('dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [lb, setLb] = useState(null);

  useEffect(() => {
    fetch('/api/availability').then(r=>r.json()).then(d=>{setServices(d.services||[]); setSettings(d.settings||null);}).catch(()=>{});
    supabaseBrowser().from('reels').select('*').eq('published',true).order('sort_order')
      .then(({data})=>{ if(data&&data.length) setReels(data.map((r,i)=>({...r,cls:THUMBS[i%6],dur:r.dur||''}))); })
      .catch(()=>{});
  }, []);

  const go = useCallback((p) => { setPage(p); setMenuOpen(false); window.scrollTo(0,0); }, []);
  function toggleTheme(){ const n=theme==='dark'?'light':'dark'; setTheme(n); document.documentElement.setAttribute('data-theme',n); }

  return (
    <>
      <BgArt />
      <nav>
        <div className="wrap" style={{display:'flex',alignItems:'center',justifyContent:'space-between',height:72}}>
          <div className="brand" onClick={()=>go('home')} style={{cursor:'pointer'}}>
            <img className="mark" src="/glam-round.png" alt="Glam by Cass" />
            <div className="brand-name gold-text">GLAM <small>By Cass</small></div>
          </div>
          <div className={'nav-links'+(menuOpen?' show':'')} id="navLinks">
            {PAGES.map(p=><a key={p} className={page===p?'active':''} onClick={()=>go(p)} style={{cursor:'pointer'}}>{p}</a>)}
          </div>
          <div className="nav-right">
            <button className="theme-btn" onClick={toggleTheme}>{theme==='dark'?'☾':'☀'}</button>
            <button className="burger" onClick={()=>setMenuOpen(!menuOpen)}>☰</button>
            <a onClick={()=>go('book')} className="btn" style={{cursor:'pointer'}}>Book Now</a>
          </div>
        </div>
      </nav>

      {page==='home' && <HomePager go={go} reels={reels} openLb={setLb} />}
      {page==='about' && <AboutPage go={go} />}
      {page==='services' && <ServicesPage services={services} go={go} />}
      {page==='portfolio' && <PortfolioPage reels={reels} openLb={setLb} />}
      {page==='book' && <BookPage />}
      {page==='contact' && <ContactPage settings={settings} />}

      {page!=='home' && <SiteFooter settings={settings} go={go} />}

      {lb && (
        <div className="lb show" onClick={()=>setLb(null)}>
          <span className="lb-close">×</span>
          <div className="lb-inner" onClick={e=>e.stopPropagation()}>
            {isUploaded(lb.video) && isImageUrl(lb.video)
              ? <img className="lb-media" src={lb.video} alt="" />
              : isUploaded(lb.video)
                ? <video className="lb-media" src={lb.video} controls autoPlay playsInline />
                : lb.video
                  ? <div className="lb-link"><a className="btn" href={lb.video} target="_blank" rel="noreferrer">Watch reel ↗</a></div>
                  : lb.thumb
                    ? <img className="lb-media" src={lb.thumb} alt="" />
                    : <div className={'thumb '+lb.cls} />}
            <div className="grad" />
            <div className="cap"><h4>{lb.name} · {lb.service}</h4><span>{lb.sub}</span></div>
          </div>
        </div>
      )}
    </>
  );
}

function BgArt(){
  useEffect(()=>{
    const s=document.getElementById('stars'); if(!s||s.childElementCount) return;
    for(let i=0;i<44;i++){ const e=document.createElement('span'); const sz=Math.random()*2+1; e.style.width=e.style.height=sz+'px'; e.style.left=Math.random()*100+'%'; e.style.top=Math.random()*100+'%'; e.style.animationDelay=Math.random()*4+'s'; s.appendChild(e); }
  },[]);
  return (
    <>
      <div className="bg-art"><div className="halo h1"></div><div className="halo h2"></div><div className="halo h3"></div></div>
      <div className="stars" id="stars"></div>
    </>
  );
}

/* ================= HOME with one-scroll fade pager ================= */
function HomePager({ go, reels, openLb }){
  const [idx, setIdx] = useState(0);
  const lock = useRef(false);
  const sections = ['s-hero','s-work','s-cta'];

  const pagerGo = useCallback((i)=>{
    if(i<0||i>=sections.length||lock.current) return;
    lock.current=true; setIdx(i); setTimeout(()=>lock.current=false,1000);
  },[]);

  useEffect(()=>{
    const isMobile=()=>window.innerWidth<=760;
    function wheel(e){ if(isMobile())return; e.preventDefault(); if(lock.current)return; if(e.deltaY>18)pagerGo(idxRef.current+1); else if(e.deltaY<-18)pagerGo(idxRef.current-1); }
    let ty=0, tx=0;
    function ts(e){ ty=e.touches[0].clientY; tx=e.touches[0].clientX; }
    function te(e){
      const dy=ty-e.changedTouches[0].clientY;
      const dx=tx-e.changedTouches[0].clientX;
      // ignore mostly-horizontal swipes — those belong to the coverflow
      if(Math.abs(dx)>Math.abs(dy)) return;
      if(dy>50)pagerGo(idxRef.current+1); else if(dy<-50)pagerGo(idxRef.current-1);
    }
    function key(e){ if(isMobile())return; if(e.key==='ArrowDown'||e.key==='PageDown'){e.preventDefault();pagerGo(idxRef.current+1);} if(e.key==='ArrowUp'||e.key==='PageUp'){e.preventDefault();pagerGo(idxRef.current-1);} }
    const el=document.getElementById('scroller');
    el?.addEventListener('wheel',wheel,{passive:false});
    el?.addEventListener('touchstart',ts,{passive:true});
    el?.addEventListener('touchend',te);
    window.addEventListener('keydown',key);
    return ()=>{ el?.removeEventListener('wheel',wheel); el?.removeEventListener('touchstart',ts); el?.removeEventListener('touchend',te); window.removeEventListener('keydown',key); };
  },[pagerGo]);

  const idxRef=useRef(0); useEffect(()=>{idxRef.current=idx;},[idx]);
  const cls=(i)=> 'snap'+(i===0?' hero':'')+(i===idx?' active':i<idx?' leaving-up':'');

  return (
    <div className="page on" id="page-home">
      <div className="scroller" id="scroller">
        {/* HERO */}
        <section className={cls(0)} id="s-hero">
          <HeroField />
          <div className="hero-orb" aria-hidden="true"></div>
          <div className="hero-content">
            <img className="hero-crest rise in" src="/glam-round.png" alt="Glam by Cass" />
            <div className="eyebrow rise in">Enhance · Empower · Elevate</div>
            <h1 className="gold-text rise in d1">Glam by Cass</h1>
            <div className="tagline gold-text rise in d2">It's a whole experience</div>
            <p className="silver-text rise in d2">Luxury bridal, editorial &amp; special-occasion makeup artistry in Los Angeles. Reserve your date in moments.</p>
            <div className="hero-cta rise in d3">
              <a onClick={()=>go('book')} className="btn" style={{cursor:'pointer'}}>Check Availability</a>
              <a onClick={()=>go('portfolio')} className="btn ghost" style={{cursor:'pointer'}}>View Portfolio</a>
            </div>
          </div>
          <div className="scroll-hint" onClick={()=>pagerGo(1)}><span>Scroll</span><span className="chev"></span></div>
        </section>

        {/* mobile-only: jump up one section (only visible when not on hero) */}
        <button className={'m-upbtn'+(idx>0?' show':'')} onClick={()=>pagerGo(idx-1)} aria-label="Previous section">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
        </button>

        {/* WORK / coverflow */}
        <section className={cls(1)} id="s-work">
          <div className="wrap">
            <div className="sec-head">
              <div className={'eyebrow rise'+(idx>=1?' in':'')}>Client Reels</div>
              <h2 className={'gold-text rise d1'+(idx>=1?' in':'')}>Real Work, Real Faces</h2>
              <div className={'orn rise d2'+(idx>=1?' in':'')}><i></i></div>
            </div>
            <Coverflow reels={reels} openLb={openLb} active={idx>=1} />
            <div style={{textAlign:'center',marginTop:26}} className={'rise d2'+(idx>=1?' in':'')}><a onClick={()=>go('portfolio')} className="btn ghost" style={{cursor:'pointer'}}>See Full Portfolio</a></div>
          </div>
          <div className="scroll-hint" onClick={()=>pagerGo(2)}><span>Scroll</span><span className="chev"></span></div>
        </section>

        {/* CTA */}
        <section className={cls(2)} id="s-cta">
          <div className="wrap" style={{textAlign:'center'}}>
            <div className="sec-head" style={{marginBottom:24}}>
              <div className={'eyebrow rise'+(idx>=2?' in':'')}>Ready When You Are</div>
              <h2 className={'gold-text rise d1'+(idx>=2?' in':'')}>Reserve Your Date</h2>
              <p className={'silver-text rise d2'+(idx>=2?' in':'')}>Secure your booking with a simple deposit. Balance paid on the day.</p>
              <div className={'orn rise d2'+(idx>=2?' in':'')}><i></i></div>
            </div>
            <div className={'rise d3'+(idx>=2?' in':'')}><a onClick={()=>go('book')} className="btn" style={{cursor:'pointer'}}>Book Now</a></div>
            <div className={'svc-strip rise d3'+(idx>=2?' in':'')} style={{marginTop:44}}>Makeup <span>◆</span> Special Occasions <span>◆</span> Bridal <span>◆</span> Photoshoots <span>◆</span> Glam Classes</div>
            <div className={'home-copyright rise d3'+(idx>=2?' in':'')}>© {new Date().getFullYear()} Glam by Cass. All rights reserved.</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroField(){
  const spots=[[8,18,86],[20,68,70],[15,80,60],[80,22,78],[86,72,64],[72,44,54],[40,12,50],[60,84,58],[92,46,44],[6,52,48],[50,58,40],[30,88,46]];
  return (
    <div className="hero-field" aria-hidden="true">
      {spots.map(([x,y,sz],i)=>(
        <div key={i} className="flo" style={{left:x+'%',top:y+'%',width:sz,height:sz,'--dur':(11+i)+'s',animationDelay:(-i)+'s',opacity:0.11}}>
          <img src="/glam-round.png" alt="" />
        </div>
      ))}
    </div>
  );
}

/* ================= COVERFLOW (matches HTML: translateZ depth + rotateY) ================= */
function Coverflow({ reels, openLb, active }){
  const [i, setI] = useState(0);
  const wrapRef = useRef(null);
  const n = reels.length || 1;
  const go = (k)=> setI(((k%n)+n)%n);
  const move = (d)=> go(i+d);

  useEffect(()=>{
    const cf=wrapRef.current; if(!cf) return;
    let sx=0,down=false;
    const start=x=>{down=true;sx=x;};
    const mv=x=>{ if(!down)return; if(Math.abs(x-sx)>50){ move(x<sx?1:-1); down=false; } };
    const end=()=>{down=false;};
    const ts=e=>start(e.touches[0].clientX);
    const tm=e=>mv(e.touches[0].clientX);
    const md=e=>start(e.clientX);
    const mm=e=>mv(e.clientX);
    cf.addEventListener('touchstart',ts,{passive:true});
    cf.addEventListener('touchmove',tm,{passive:true});
    cf.addEventListener('touchend',end);
    cf.addEventListener('mousedown',md);
    window.addEventListener('mousemove',mm);
    window.addEventListener('mouseup',end);
    return ()=>{ cf.removeEventListener('touchstart',ts); cf.removeEventListener('touchmove',tm); cf.removeEventListener('touchend',end); cf.removeEventListener('mousedown',md); window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',end); };
  },[i,n]);

  const vw = typeof window!=='undefined'?Math.min(window.innerWidth,900):900;
  const spread = vw<760?vw*0.30:150;

  return (
    <>
      <div className={'coverflow rise d1'+(active?' in':'')} id="coverflow" ref={wrapRef}>
        <div className="cf-track" id="cfTrack">
          {reels.map((r,k)=>{
            let off=k-i; if(off>n/2)off-=n; if(off<-n/2)off+=n;
            const abs=Math.abs(off);
            const style={
              transform:`translateX(${off*spread}px) translateZ(${-abs*160}px) rotateY(${off*-22}deg) scale(${off===0?1:abs===1?.78:.62})`,
              opacity: abs>2?0:off===0?1:abs===1?.7:.35,
              zIndex:100-abs,
              filter: off===0?'none':'brightness(.55)',
              pointerEvents: abs>2?'none':'auto',
            };
            return (
              <div key={r.id} className={'cf-card'+(off===0?' center':'')} style={style}
                   onClick={()=> off===0 ? openLb({name:r.client_name,service:r.service,sub:`${r.look}${r.dur?' · '+r.dur:''}`,cls:r.cls,video:r.video_url,thumb:r.thumbnail_url}) : move(off>0?1:-1)}>
                {r.thumbnail_url
                  ? <img className="reel-media" src={r.thumbnail_url} alt="" />
                  : isUploaded(r.video_url) && isImageUrl(r.video_url)
                    ? <img className="reel-media" src={r.video_url} alt="" />
                    : isUploaded(r.video_url)
                      ? <video className="reel-media" src={r.video_url} muted playsInline preload="metadata" />
                      : <div className={'thumb '+r.cls} />}
                <div className="grad" />{!(isUploaded(r.video_url) && isImageUrl(r.video_url)) && <div className="pl" />}
                <div className="meta"><h4>{r.client_name} · {r.service}</h4><span>{r.look}{r.dur?' · '+r.dur:''}</span></div>
              </div>
            );
          })}
        </div>
        <button className="cf-nav prev" onClick={()=>move(-1)} aria-label="Previous">‹</button>
        <button className="cf-nav next" onClick={()=>move(1)} aria-label="Next">›</button>
      </div>
      <div className="cf-dots" id="cfDots">
        {reels.map((_,k)=><button key={k} className={k===i?'on':''} onClick={()=>go(k)} />)}
      </div>
    </>
  );
}

/* ================= SUBPAGES ================= */
function AboutPage({ go }){
  return (
    <div className="page on" id="page-about">
      <div className="wrap" style={{paddingTop:96,paddingBottom:50}}>
        <div className="sec-head"><div className="eyebrow rise in">The Artist</div><h2 className="gold-text rise in d1">About Cass</h2><div className="orn rise in d2"><i></i></div></div>
        <div className="about-grid">
          <div className="framed about-emblem rise in d1"><img className="about-mark" src="/glam-logo.png" alt="Glam by Cass" /></div>
          <div className="about-text rise in d2">
            <h3 className="gold-text">It's not just makeup. It's a whole experience.</h3>
            <p>Cass is a Los Angeles-based makeup artist specialising in bridal, editorial and special-occasion glam. Every look is built around the person wearing it — enhancing natural features, never masking them.</p>
            <p>From intimate one-on-one glam classes to full bridal parties and on-set editorial work, the goal is always the same: to help you feel luminous, confident, and entirely yourself.</p>
            <div className="about-stats">
              <div><div className="n gold-text">320+</div><div className="l">Clients</div></div>
              <div><div className="n gold-text">5★</div><div className="l">Rated</div></div>
              <div><div className="n gold-text">2021</div><div className="l">Since</div></div>
            </div>
            <div style={{marginTop:30}}><a onClick={()=>go('book')} className="btn" style={{cursor:'pointer'}}>Book a Session</a></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServicesPage({ services, go }){
  return (
    <div className="page on" id="page-services">
      <div className="wrap" style={{paddingTop:96,paddingBottom:50}}>
        <div className="sec-head"><div className="eyebrow rise in">What I Offer</div><h2 className="gold-text rise in d1">Services</h2><p className="silver-text rise in d2">Every service includes a consultation to plan your perfect look.</p><div className="orn rise in d2"><i></i></div></div>
        <div className="svc-cards" id="svcCards">
          {services.map(s=>(
            <div className="svc-card rise in" key={s.id}>
              <img className="ico" src="/glam-round.png" alt="" />
              <h4 className="gold-text">{s.name}</h4>
              <div className="price">from €{Number(s.price).toFixed(0)}</div>
              <p>{s.description}</p>
            </div>
          ))}
          {!services.length && <p className="muted">Loading services…</p>}
        </div>
        <div style={{textAlign:'center',marginTop:40}} className="rise in d2"><a onClick={()=>go('book')} className="btn" style={{cursor:'pointer'}}>Check Availability</a></div>
      </div>
    </div>
  );
}

function PortfolioPage({ reels, openLb }){
  return (
    <div className="page on" id="page-portfolio">
      <div className="wrap" style={{paddingTop:96,paddingBottom:50}}>
        <div className="sec-head"><div className="eyebrow rise in">Client Reels</div><h2 className="gold-text rise in d1">Portfolio</h2><p className="silver-text rise in d2">Every look created on a real client. Tap any reel to watch.</p><div className="orn rise in d2"><i></i></div></div>
        <div className="vid-grid" id="fullGallery">
          {reels.map(r=>(
            <div className="vid rise in" key={r.id} onClick={()=>openLb({name:r.client_name,service:r.service,sub:`${r.look}${r.dur?' · '+r.dur:''}`,cls:r.cls,video:r.video_url,thumb:r.thumbnail_url})}>
              {r.thumbnail_url
                ? <img className="reel-media" src={r.thumbnail_url} alt="" />
                : isUploaded(r.video_url) && isImageUrl(r.video_url)
                  ? <img className="reel-media" src={r.video_url} alt="" />
                  : isUploaded(r.video_url)
                    ? <video className="reel-media" src={r.video_url} muted playsInline preload="metadata" />
                    : <div className={'thumb '+r.cls} />}
              <div className="grad" />{!(isUploaded(r.video_url) && isImageUrl(r.video_url)) && <div className="play" />}
              <div className="meta"><h4>{r.client_name} · {r.service}</h4><span>{r.look}{r.dur?' · '+r.dur:''}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookPage(){
  return (
    <div className="page on" id="page-book">
      <div className="wrap" style={{paddingTop:96,paddingBottom:50}}>
        <div className="sec-head"><div className="eyebrow rise in">Reserve Your Date</div><h2 className="gold-text rise in d1">Book a Session</h2><p className="silver-text rise in d2">Pick a service, choose a time, secure with a deposit.</p><div className="orn rise in d2"><i></i></div></div>
        <BookingCalendar />
      </div>
    </div>
  );
}

function SiteFooter({ settings, go }){
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <p>© {year} Glam by Cass. All rights reserved.</p>
      <p className="footer-fine">All content, imagery, branding and designs on this site are the property of Glam by Cass and may not be reproduced, copied or used without written permission.</p>
    </footer>
  );
}


function ContactPage({ settings }){
  const [f,setF]=useState({name:'',email:'',body:''});
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState('');
  const [sending,setSending]=useState(false);
  async function send(){
    setErr('');
    if(!f.name.trim()) return setErr('Please enter your name.');
    if(!f.email.trim()) return setErr('Please enter your email so Cass can reply.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr('That email doesn\u2019t look right — please check it.');
    if(!f.body.trim()) return setErr('Please write a message.');
    setSending(true);
    try {
      const res = await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)});
      const data = await res.json();
      setSending(false);
      if(!res.ok){ setErr(data.error||'Could not send — please try again.'); return; }
      setSent(true);
      setF({name:'',email:'',body:''});
      setTimeout(()=>setSent(false), 3200);
    } catch(e){ setSending(false); setErr('Could not send — please try again.'); }
  }
  const s = settings || {};
  const phone = s.phone || '(555) 123-4567';
  const email = s.email || 'hello@glambycass.com';
  const location = s.location || 'Los Angeles, CA';
  const telHref = 'tel:'+phone.replace(/[^\d+]/g,'');
  return (
    <div className="page on" id="page-contact">
      <div className="wrap" style={{paddingTop:96,paddingBottom:40}}>
        <div className="sec-head"><div className="eyebrow rise in">Get In Touch</div><h2 className="gold-text rise in d1">Contact</h2><p className="silver-text rise in d2">Book, ask a question, or say hello.</p><div className="orn rise in d2"><i></i></div></div>
        <div className="contact-grid">
          <div className="framed rise in d1" style={{padding:28}}>
            {sent ? (
              <div className="sent-confirm">
                <div className="sent-check">✓</div>
                <p className="gold-text">Message sent!</p>
                <p className="muted">Thank you — Cass will reply by email.</p>
              </div>
            ) : (
              <div className="contact-form">
                <input className={err&&!f.name.trim()?'invalid':''} placeholder="Your name *" value={f.name} onChange={e=>setF({...f,name:e.target.value})} required />
                <input className={err&&(!f.email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))?'invalid':''} type="email" placeholder="Email *" value={f.email} onChange={e=>setF({...f,email:e.target.value})} required />
                <textarea className={err&&!f.body.trim()?'invalid':''} rows={4} placeholder="Your message *" value={f.body} onChange={e=>setF({...f,body:e.target.value})} required />
                {err && <div className="err">{err}</div>}
                <button className="btn" style={{width:'100%',justifyContent:'center'}} onClick={send} disabled={sending}>{sending?'Sending…':'Send Message'}</button>
                <div className="req-note">* All fields required.</div>
              </div>
            )}
          </div>
          <div className="contact-info centered rise in d2">
            <a className="ci-row" href={telHref}><div className="ico">✆</div><div><div className="l">Call or Text</div><div className="v gold-text">{phone}</div></div></a>
            <a className="ci-row" href={'mailto:'+email}><div className="ico">✉</div><div><div className="l">Email</div><div className="v gold-text">{email}</div></div></a>
            <div className="ci-row"><div className="ico">⚲</div><div><div className="l">Based In</div><div className="v gold-text">{location}</div></div></div>
            {(s.instagram||s.tiktok) && (
              <div className="ci-socials">
                {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer">Instagram</a>}
                {s.tiktok && <a href={s.tiktok} target="_blank" rel="noreferrer">TikTok</a>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
