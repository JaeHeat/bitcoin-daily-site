/* Bitcoin Daily - shared chart renderers for the /charts/ indicator pages.
   Each per-indicator page has ONE <canvas id="chart">, optional #read / #table / #assume / #bands,
   optional buttons #logtoggle and #save. Call BDCharts.render(key, D) with the parsed charts_data.json.
   Education, not financial advice. */
(function (global) {
  const C = { orange:'#f7931a', teal:'#2dd4bf', muted:'#9aa7bd', text:'#e8edf6', red:'#e2574a', blue:'#2f6fb0', line:'rgba(255,255,255,.09)' };
  const fmtUSD = n => n>=1000 ? '$'+Math.round(n).toLocaleString() : '$'+(n<10?n.toFixed(2):n.toFixed(0));
  const fmtDate = s => new Date(s+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const logTick = v => [0.001,0.01,0.1,1,10,100,1000,10000,100000,1000000].includes(v) ? (v>=1000?'$'+(v/1000)+'k':'$'+v) : '';
  const $ = id => document.getElementById(id);

  const watermark = { id:'wm',
    beforeDatasetsDraw(ch){ const a=ch.chartArea; if(!a) return; const g=ch.ctx;
      g.save(); g.globalAlpha=.06; g.fillStyle='#fff'; g.font='800 44px -apple-system,sans-serif';
      g.textAlign='center'; g.textBaseline='middle'; g.fillText('Bitcoin Daily',(a.left+a.right)/2,(a.top+a.bottom)/2); g.restore(); },
    afterDraw(ch){ const a=ch.chartArea; if(!a) return; const g=ch.ctx;
      g.save(); g.globalAlpha=.6; g.fillStyle=C.muted; g.font='600 11px -apple-system,sans-serif';
      g.textAlign='right'; g.textBaseline='bottom'; g.fillText('bitcoin-daily.com',a.right-6,a.bottom-6); g.restore(); } };

  const thresholds = lines => ({ id:'th', beforeDatasetsDraw(ch){ const a=ch.chartArea,y=ch.scales.y,g=ch.ctx; if(!a) return;
    lines.forEach(L=>{ const py=y.getPixelForValue(L.v); if(py<a.top||py>a.bottom) return;
      g.save(); g.strokeStyle=L.c; g.lineWidth=1.2; g.setLineDash([5,4]); g.beginPath(); g.moveTo(a.left,py); g.lineTo(a.right,py); g.stroke();
      g.setLineDash([]); g.fillStyle=L.c; g.font='600 11px -apple-system,sans-serif'; g.textAlign='left'; g.textBaseline='bottom'; g.fillText(L.t,a.left+6,py-3); g.restore(); }); } });

  const verticals = (dates,labels) => ({ id:'vt', afterDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,g=ch.ctx; if(!a) return;
    dates.forEach((d,i)=>{ const px=x.getPixelForValue(d); if(px==null||px<a.left||px>a.right) return;
      g.save(); g.strokeStyle='rgba(226,87,74,.7)'; g.lineWidth=1; g.setLineDash([3,3]); g.beginPath(); g.moveTo(px,a.top); g.lineTo(px,a.bottom); g.stroke();
      g.setLineDash([]); g.fillStyle=C.red; g.font='700 10px -apple-system,sans-serif'; g.textAlign='center'; g.fillText(labels?labels[i]:'top',px,a.top+11); g.restore(); }); } });

  // shade the background green where two series move the same direction, red where opposite (agree flag)
  const agreeShade = series => ({ id:'agree', beforeDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,g=ch.ctx; if(!a) return;
    for(let i=1;i<series.length;i++){ const ag=series[i].agree; if(ag==null) continue;
      const x0=x.getPixelForValue(i-1), x1=x.getPixelForValue(i);
      g.save(); g.fillStyle = ag ? 'rgba(78,201,122,.14)' : 'rgba(226,87,74,.16)'; g.fillRect(x0,a.top,Math.max(1,x1-x0),a.bottom-a.top); g.restore(); } } });

  // vertical markers at the dated cycle tops (orange) and bottoms (teal), so any indicator can be
  // read against where price actually turned. Subtle white line + colored TOP/BOT label (reads on any bg).
  const cycleMarks = D => ({ id:'cyc', afterDatasetsDraw(ch){ if(!D.cycle) return; const a=ch.chartArea,x=ch.scales.x,g=ch.ctx; if(!a) return;
    const labels=ch.data.labels; if(!labels||!labels.length) return;
    const t0=Date.parse(labels[0]), t1=Date.parse(labels[labels.length-1]), WK=6048e5;
    const nearest=ds=>{ const t=Date.parse(ds); let bi=0,bd=1e18; for(let i=0;i<labels.length;i++){ const dd=Math.abs(Date.parse(labels[i])-t); if(dd<bd){bd=dd;bi=i;} } return bi; };
    const draw=(dates,color,tag)=>(dates||[]).forEach(ds=>{ const t=Date.parse(ds); if(t<t0-WK||t>t1+WK) return;
      const px=x.getPixelForValue(nearest(ds)); if(px<a.left||px>a.right) return;
      g.save(); g.strokeStyle='rgba(255,255,255,.30)'; g.lineWidth=1; g.setLineDash([4,3]); g.beginPath(); g.moveTo(px,a.top); g.lineTo(px,a.bottom); g.stroke();
      g.setLineDash([]); g.fillStyle=color; g.font='700 9px -apple-system,sans-serif'; g.textAlign='center'; g.textBaseline='top'; g.fillText(tag,px,a.top+2); g.restore(); });
    draw(D.cycle.tops, C.orange, 'TOP'); draw(D.cycle.bottoms, C.teal, 'BOT'); } });

  // triangle markers on the price line: red down-triangle at cycle tops, green up-triangle at bottoms (for the split price panel)
  const cycleTris = (D, series) => ({ id:'ctri', afterDatasetsDraw(ch){ if(!D.cycle) return; const a=ch.chartArea,x=ch.scales.x,y=ch.scales.y,g=ch.ctx; if(!a) return;
    const labels=ch.data.labels; if(!labels||!labels.length) return; const t0=Date.parse(labels[0]), t1=Date.parse(labels[labels.length-1]);
    const nearest=ds=>{ const t=Date.parse(ds); let bi=0,bd=1e18; for(let i=0;i<labels.length;i++){ const dd=Math.abs(Date.parse(labels[i])-t); if(dd<bd){bd=dd;bi=i;} } return bi; };
    const tri=(ds,color,up)=>{ const t=Date.parse(ds); if(t<t0||t>t1) return; const i=nearest(ds), px=x.getPixelForValue(i), py=y.getPixelForValue(series[i].btc);
      if(px<a.left||px>a.right) return; const s=6, o=up?14:-14; g.save(); g.fillStyle=color; g.beginPath();
      if(up){ g.moveTo(px,py+o-s); g.lineTo(px-s,py+o+s*0.7); g.lineTo(px+s,py+o+s*0.7); } else { g.moveTo(px,py+o+s); g.lineTo(px-s,py+o-s*0.7); g.lineTo(px+s,py+o-s*0.7); }
      g.closePath(); g.fill(); g.restore(); };
    (D.cycle.tops||[]).forEach(d=>tri(d,C.red,false)); (D.cycle.bottoms||[]).forEach(d=>tri(d,C.teal,true)); } });

  // dashed vertical lines at the halvings, spanning a panel (for the split price + PMI panels)
  const halvingLines = D => ({ id:'halv', afterDatasetsDraw(ch){ if(!D.halvings) return; const a=ch.chartArea,x=ch.scales.x,g=ch.ctx; if(!a) return;
    const labels=ch.data.labels; if(!labels||!labels.length) return; const t0=Date.parse(labels[0]), t1=Date.parse(labels[labels.length-1]);
    const nearest=ds=>{ const t=Date.parse(ds); let bi=0,bd=1e18; for(let i=0;i<labels.length;i++){ const dd=Math.abs(Date.parse(labels[i])-t); if(dd<bd){bd=dd;bi=i;} } return bi; };
    D.halvings.forEach(ds=>{ const t=Date.parse(ds); if(t<t0||t>t1) return; const px=x.getPixelForValue(nearest(ds)); if(px<a.left||px>a.right) return;
      g.save(); g.strokeStyle='rgba(247,147,26,.5)'; g.lineWidth=1; g.setLineDash([5,4]); g.beginPath(); g.moveTo(px,a.top); g.lineTo(px,a.bottom); g.stroke(); g.restore(); }); } });

  // the PMI 50 line (expansion above, contraction below), for the split PMI panel
  const pmi50line = { id:'pmi50', beforeDatasetsDraw(ch){ const a=ch.chartArea,y=ch.scales.y,g=ch.ctx; if(!a) return; const py=y.getPixelForValue(50);
    g.save(); g.strokeStyle='rgba(255,255,255,.32)'; g.lineWidth=1; g.beginPath(); g.moveTo(a.left,py); g.lineTo(a.right,py); g.stroke();
    g.fillStyle=C.muted; g.font='600 10px -apple-system,sans-serif'; g.textAlign='left'; g.textBaseline='bottom'; g.fillText('50 = flat',a.left+5,py-2); g.restore(); } };

  const baseOpts = extra => Object.assign({
    responsive:true, maintainAspectRatio:false, animation:false, interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'#0b0e14', borderColor:'rgba(255,255,255,.12)', borderWidth:1, padding:10 } },
    scales:{ x:{ grid:{display:false}, ticks:{ color:C.muted, font:{size:12}, maxTicksLimit:9, autoSkip:true, callback:function(i){ const l=this.getLabelForValue(i); return l?String(l).slice(0,4):''; } } },
             y:{ grid:{color:C.line}, ticks:{ color:C.muted, font:{size:12} } } } }, extra||{});

  function saveImg(title){ const src=$('chart'); if(!src) return; const sub=$('chart2'); const dpr=window.devicePixelRatio||1;
    const hH=Math.round(58*dpr), fH=Math.round(36*dpr), subH=sub?sub.height:0, o=document.createElement('canvas'); o.width=src.width; o.height=src.height+subH+hH+fH;
    const g=o.getContext('2d'); g.fillStyle='#0b0e14'; g.fillRect(0,0,o.width,o.height); g.textBaseline='middle'; g.textAlign='left';
    g.fillStyle='#f7931a'; g.font='800 '+Math.round(20*dpr)+'px -apple-system,sans-serif'; g.fillText('Bitcoin Daily',Math.round(20*dpr),hH/2);
    g.textAlign='right'; g.fillStyle='#aeb6c4'; g.font='600 '+Math.round(14*dpr)+'px -apple-system,sans-serif'; g.fillText(title||'',o.width-Math.round(20*dpr),hH/2);
    g.drawImage(src,0,hH); if(sub) g.drawImage(sub,0,hH+src.height); const fy=src.height+subH+hH+fH/2; g.textAlign='left'; g.fillStyle='#6b7280'; g.font='600 '+Math.round(12*dpr)+'px -apple-system,sans-serif';
    g.fillText('Education, not financial advice',Math.round(20*dpr),fy); g.textAlign='right'; g.fillStyle='#9aa7bd'; g.fillText('bitcoin-daily.com',o.width-Math.round(20*dpr),fy);
    const a=document.createElement('a'); a.download='bitcoin-daily-chart.png'; a.href=o.toDataURL('image/png'); a.click(); }

  const setRead = (html, up) => { const e=$('read'); if(e){ e.className='ch-read'+(up?' up':''); e.innerHTML=html; } };
  const logY = cb => ({ type:'logarithmic', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:cb||logTick} });

  // right-axis BTC price overlay (thin, muted, log) so any oscillator shows what price did at the time
  const priceOverlay = data => ({ label:'BTC price', data, borderColor:'rgba(154,167,189,.5)', borderWidth:1,
    pointRadius:0, tension:.15, yAxisID:'y2', order:2 });
  const priceAxis = () => ({ type:'logarithmic', position:'right', grid:{display:false},
    ticks:{ color:'rgba(154,167,189,.7)', font:{size:11}, callback:logTick } });

  // generic oscillator (indicator on the left axis + BTC price overlaid on a right log axis)
  function oscillator(D, key, o){ const s=D.charts[key].series, labels=s.map(d=>d.date), vals=s.map(d=>d[o.field]);
    const th=[]; if(o.hot!=null) th.push({v:o.hot,c:C.red,t:o.hotLabel}); if(o.cheap!=null) th.push({v:o.cheap,c:C.teal,t:o.cheapLabel});
    (o.extraLines||[]).forEach(L=>th.push(L));
    return new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[ priceOverlay(s.map(d=>d.price)),
        { label:o.name, data:vals, borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15, yAxisID:'y', order:1,
          segment:{ borderColor:c => (o.hot!=null && c.p1.parsed.y>=o.hot)?C.red:((o.cheap!=null && c.p1.parsed.y<=o.cheap)?C.teal:C.orange) } }] },
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.datasetIndex===0 ? 'BTC '+fmtUSD(it.parsed.y) : o.name+' '+it.parsed.y.toFixed(2) } } },
        scales:{ x:baseOpts().scales.x,
          y: o.logLeft ? { type:'logarithmic', position:'left', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>[0.1,0.25,0.5,1,2,5,10,25,50].includes(v)?v:''} }
                       : { position:'left', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12}}, suggestedMin:o.min, suggestedMax:o.max },
          y2:priceAxis() } }),
      plugins:[watermark, thresholds(th), cycleMarks(D)] }); }

  // Fear & Greed dial (alternative.me style): red=fear on the left, green=greed on the right, needle at the value
  const fngColor = v => v<=25?'#e2574a':v<=45?'#f0883e':v<55?'#d9b44a':v<75?'#8cc84b':'#2ea043';
  function drawFngGauge(v, id){ const cv=$(id||'fng-gauge'); if(!cv) return; const W=300,H=168,dpr=window.devicePixelRatio||1;
    cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px';
    const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    const cx=W/2, cy=H-16, R=116, lw=20;
    [['#e2574a',0,20],['#f0883e',20,40],['#d9b44a',40,60],['#8cc84b',60,80],['#2ea043',80,100]].forEach(s=>{
      g.beginPath(); g.lineWidth=lw; g.strokeStyle=s[0]; g.arc(cx,cy,R,Math.PI+(s[1]/100)*Math.PI+ (s[1]?0.012:0), Math.PI+(s[2]/100)*Math.PI-0.012); g.stroke(); });
    const ang=Math.PI+(Math.max(0,Math.min(100,v))/100)*Math.PI;
    const mx=cx+Math.cos(ang)*R, my=cy+Math.sin(ang)*R;      // marker sits ON the arc at the value (no center needle to cross the number)
    g.save(); g.shadowColor='rgba(0,0,0,.55)'; g.shadowBlur=5;
    g.beginPath(); g.arc(mx,my,9,0,7); g.fillStyle='#0b0e14'; g.fill();
    g.shadowBlur=0; g.beginPath(); g.arc(mx,my,6,0,7); g.fillStyle='#e8edf6'; g.fill(); g.restore(); }

  // big correlation-number cards in the hero of the correlation charts (M2 / PMI / S&P)
  function setCorrStats(cards){ const el=$('corr-stats'); if(!el) return;
    el.innerHTML = cards.map(c=>'<div class="corr-stat'+(c.cls?' '+c.cls:'')+'"><div class="n" style="color:'+(c.color||'var(--text)')
      +'">'+c.num+'</div><div class="l">'+c.label+'</div></div>').join(''); }
  const sign = n => (n>=0?'+':'')+n.toFixed(2);

  const R = {};

  R.realized_price = D => { const rp=D.charts.realized_price, s=rp.series, labels=s.map(d=>d.date), up=rp.latest.over_under_pct<0;
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'Avg holder paid', data:s.map(d=>d.realized), borderColor:C.teal, borderWidth:1.6, pointRadius:0, tension:.2, spanGaps:true },
        { label:'Price', data:s.map(d=>d.price), borderColor:C.orange, borderWidth:2.2, pointRadius:0, tension:.2, fill:0, backgroundColor:'rgba(45,212,191,.10)' } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>(it.datasetIndex===1?'Price ':'Avg holder paid ')+fmtUSD(it.parsed.y) } } }, scales:{ x:baseOpts().scales.x, y:logY() } }), plugins:[watermark, cycleMarks(D)] });
    const l=rp.latest;
    setRead(up ? 'Price is about '+Math.abs(l.over_under_pct)+'% <b>below</b> the '+fmtUSD(l.realized)+' the average holder paid. Every past bottom printed here.'
               : 'The average holder is <b>in profit</b>, price about '+l.over_under_pct+'% above the '+fmtUSD(l.realized)+' they paid. That has never been true at a cycle bottom.', up);
    const tbl=$('table'); if(tbl && rp.bottoms) tbl.innerHTML='<tr><th>Past cycle bottom</th><th>Price</th><th>Avg holder paid</th><th>How far under</th></tr>'+
      rp.bottoms.map(b=>'<tr><td>'+fmtDate(b.date)+'</td><td>'+fmtUSD(b.price)+'</td><td>'+fmtUSD(b.realized)+'</td><td>'+b.undercut_pct+'%</td></tr>').join('');
    return ch; };

  R.mvrv = D => { const ch=oscillator(D,'mvrv',{ field:'mvrv', name:'MVRV', hot:3.2, cheap:1.0, max:5, hotLabel:'froth zone', cheapLabel:'cost basis (1.0)' });
    const v=D.charts.mvrv.latest, hot=v>=3.2, cheap=v<=1;
    setRead('Now at <b>'+v.toFixed(2)+'</b>. '+(hot?'Well above the market cost basis, the historically frothy zone.':cheap?'Below the market cost basis, the average holder is underwater. This has clustered around bottoms.':'Above the market cost basis but not frothy.'), cheap); return ch; };

  R.mayer = D => { const ch=oscillator(D,'mayer',{ field:'mayer', name:'Mayer', hot:2.4, cheap:1.0, max:3.5, hotLabel:'overheated (2.4)', cheapLabel:'value (1.0)' });
    const v=D.charts.mayer.latest, hot=v>=2.4, cheap=v<=1;
    setRead('Now at <b>'+v.toFixed(2)+'</b>. '+(hot?'Overheated versus the 200-day average.':cheap?'Below the 200-day average, historically a long-term value zone.':'Above the 200-day average but not overheated.'), cheap); return ch; };

  R.puell = D => { const ch=oscillator(D,'puell',{ field:'puell', name:'Puell', hot:4.0, cheap:0.5, max:6, hotLabel:'miners overpaid (4.0)', cheapLabel:'miners starved (0.5)' });
    const v=D.charts.puell.latest, hot=v>=4, cheap=v<=0.5;
    setRead('Now at <b>'+v.toFixed(2)+'</b>. '+(hot?'Miners are being paid unusually well, which has marked tops.':cheap?'Miners are earning far less than usual, which has marked bottoms.':'Miner pay is near its one-year normal.'), cheap); return ch; };

  R.nupl = D => { const o=D.charts.nupl, s=o.series, labels=s.map(d=>d.date);
    const zoneLines=[{v:0,c:C.teal,t:'0 = break-even'},{v:0.25,c:C.muted,t:'hope / fear'},{v:0.5,c:C.muted,t:'optimism / anxiety'},{v:0.75,c:C.red,t:'belief / denial -> euphoria'}];
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[ priceOverlay(s.map(d=>d.price)),
        { label:'NUPL', data:s.map(d=>d.nupl), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15, yAxisID:'y', order:1,
          segment:{ borderColor:c=>{const y=c.p1.parsed.y; return y>=0.75?C.red:y>=0.5?'#f4a259':y>=0.25?C.orange:y>=0?'#c6e08b':C.blue;} } }] },
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.datasetIndex===0 ? 'BTC '+fmtUSD(it.parsed.y) : 'NUPL '+it.parsed.y.toFixed(3) } } },
        scales:{ x:baseOpts().scales.x, y:{ grid:{color:C.line}, ticks:{color:C.muted,font:{size:12}}, suggestedMin:-0.25, suggestedMax:0.9 }, y2:priceAxis() } }), plugins:[watermark, thresholds(zoneLines), cycleMarks(D)] });
    setRead('Now at <b>'+o.latest.toFixed(2)+'</b>, the <b>'+o.current_zone+'</b> zone. Below zero means the market as a whole is underwater, which has marked bottoms.', o.latest<0.25); return ch; };

  R.pi_cycle = D => { const s=D.charts.pi_cycle.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'Price', data:s.map(d=>d.price), borderColor:C.muted, borderWidth:1, pointRadius:0, tension:.2 },
        { label:'111-day', data:s.map(d=>d.ma111), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.2 },
        { label:'2x 350-day', data:s.map(d=>d.ma350x2), borderColor:C.teal, borderWidth:2, pointRadius:0, tension:.2 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>['Price','111-day avg','2x 350-day avg'][it.datasetIndex]+' '+fmtUSD(it.parsed.y) } } }, scales:{ x:baseOpts().scales.x, y:logY() } }),
      plugins:[watermark, verticals(D.charts.pi_cycle.crosses), cycleMarks(D)] });
    setRead('Fired at '+D.charts.pi_cycle.crosses.length+' past tops. The 111-day average now sits about <b>'+Math.abs(D.charts.pi_cycle.gap_pct)+'% below</b> the trigger, so no top signal is close.'); return ch; };

  R.ma200w = D => { const s=D.charts.ma200w.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'200-week', data:s.map(d=>d.ma200w), borderColor:C.teal, borderWidth:2, pointRadius:0, tension:.2 },
        { label:'Price', data:s.map(d=>d.price), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.2 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>(it.datasetIndex===1?'Price ':'200-week avg ')+fmtUSD(it.parsed.y) } } }, scales:{ x:baseOpts().scales.x, y:logY() } }), plugins:[watermark, cycleMarks(D)] });
    const l=D.charts.ma200w.latest; setRead('Price is <b>'+l.mult.toFixed(2)+'x</b> its 200-week average of '+fmtUSD(l.ma200w)+'. '+(l.mult<1.3?'That is close to the floor Bitcoin has only broken at deep bear-market lows.':'Room above the long-term floor.'), l.mult<1.3); return ch; };

  R.power_law = D => { const P=D.charts.power_law, s=P.series, gen=Date.UTC(2009,0,3);
    const day=d=>Math.max(1,(Date.parse(d.date)-gen)/86400000), dates=s.map(d=>d.date);
    const pt=f=>s.map(d=>({x:day(d), y:d[f]})), yr=y=>(Date.UTC(y,0,1)-gen)/86400000;
    const years=[2011,2013,2015,2017,2019,2021,2023,2025,2027,2029], lo=day(s[0]), hi=day(s[s.length-1]);
    const ch=new Chart($('chart'), { type:'line', data:{ datasets:[
      { label:'Resistance', data:pt('resist'), borderColor:'rgba(226,87,74,.6)', borderWidth:1.5, borderDash:[5,4], pointRadius:0, tension:0, order:3 },
      { label:'Support', data:pt('support'), borderColor:'rgba(78,201,122,.65)', borderWidth:1.5, borderDash:[5,4], pointRadius:0, tension:0, fill:'-1', backgroundColor:'rgba(247,147,26,.05)', order:4 },
      { label:'Power-law fair value', data:pt('center'), borderColor:C.orange, borderWidth:2.6, pointRadius:0, tension:0, order:1 },
      { label:'Price', data:pt('price'), borderColor:'#2f6fb0', borderWidth:2.6, pointRadius:0, tension:0, order:0 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ mode:'index', intersect:false,
          filter:it=>it.dataset.label==='Price'||it.dataset.label==='Power-law fair value',
          callbacks:{ title:it=>fmtDate(dates[it[0].dataIndex]), label:it=>it.dataset.label+' '+fmtUSD(it.parsed.y) } } },
        scales:{ x:{ type:'logarithmic', grid:{display:false},
            afterBuildTicks:ax=>{ const mn=ax.min!=null?ax.min:lo, mx=ax.max!=null?ax.max:hi; ax.ticks=years.filter(y=>yr(y)>=mn&&yr(y)<=mx).map(y=>({value:yr(y)})); },
            ticks:{ color:C.muted, font:{size:12}, autoSkip:false, callback:v=>{ const yy=new Date(gen+v*86400000).getUTCFullYear(); return years.includes(yy)?String(yy):''; } } },
          y:logY() } }), plugins:[watermark] });
    const L=P.latest;
    setRead('Bitcoin is around <b>'+fmtUSD(L.price)+'</b>, about <b>'+(L.vs_fair_pct>=0?'+':'')+L.vs_fair_pct+'%</b> '+(L.vs_fair_pct>=0?'above':'below')+' its power-law fair value of <b>'+fmtUSD(L.fair)+'</b>. That puts it about <b>'+Math.round(L.corridor_pos)+'%</b> of the way from the green support line up to the red resistance line. Stretching both axes by the same log amount is what turns fifteen years of history into one near-straight line.', L.vs_fair_pct<0);
    return ch; };

  R.bottom_zone = D => { const B=D.charts.bottom_zone, s=B.series, labels=s.map(d=>d.date), val=f=>s.map(d=>d[f]);
    const t0=Date.parse(labels[0]), t1=Date.parse(labels[labels.length-1]);
    const nearest=ds=>{ const t=Date.parse(ds); let bi=0,bd=1e18; for(let i=0;i<labels.length;i++){ const dd=Math.abs(Date.parse(labels[i])-t); if(dd<bd){bd=dd;bi=i;} } return bi; };
    const winI=[nearest(B.window[0]), nearest(B.window[1])];
    const windowShade={ id:'winb', beforeDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,g=ch.ctx; if(!a) return;
      let x0=x.getPixelForValue(winI[0]), x1=x.getPixelForValue(winI[1]); if(x1<a.left||x0>a.right) return; x0=Math.max(a.left,x0); x1=Math.min(a.right,x1);
      g.save(); g.fillStyle='rgba(78,201,122,.16)'; g.fillRect(x0,a.top,Math.max(2,x1-x0),a.bottom-a.top);
      g.fillStyle=C.teal; g.font='700 10px -apple-system,sans-serif'; g.textAlign='center'; g.textBaseline='top'; g.fillText('bottom window',(x0+x1)/2,a.top+2); g.restore(); } };
    const halvLines={ id:'halvb', afterDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,g=ch.ctx; if(!a) return;
      (B.halvings||[]).forEach(h=>{ const t=Date.parse(h); if(t<t0||t>t1) return; const px=x.getPixelForValue(nearest(h)); if(px<a.left||px>a.right) return;
        g.save(); g.strokeStyle='rgba(247,147,26,.4)'; g.lineWidth=1; g.setLineDash([5,4]); g.beginPath(); g.moveTo(px,a.top); g.lineTo(px,a.bottom); g.stroke(); g.restore(); }); } };
    const botDots={ id:'botb', afterDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,y=ch.scales.y,g=ch.ctx; if(!a) return;
      (B.bottoms||[]).forEach(b=>{ const t=Date.parse(b.date); if(t<t0||t>t1) return; const px=x.getPixelForValue(nearest(b.date)), py=y.getPixelForValue(b.price); if(px<a.left||px>a.right||py<a.top||py>a.bottom) return;
        g.save(); g.fillStyle=C.teal; g.strokeStyle='#0b0e14'; g.lineWidth=1.5; g.beginPath(); g.arc(px,py,4,0,7); g.fill(); g.stroke(); g.restore(); }); } };
    const ch=new Chart($('chart'), { type:'line', data:{ labels:labels, datasets:[
      { label:'Zone top', data:val('zt'), borderColor:'rgba(0,0,0,0)', borderWidth:0, pointRadius:0, tension:.2 },
      { label:'Bottom zone', data:val('zb'), borderColor:'rgba(0,0,0,0)', borderWidth:0, pointRadius:0, tension:.2, fill:'-1', backgroundColor:'rgba(78,201,122,.15)' },
      { label:'Support', data:val('dn1'), borderColor:C.teal, borderWidth:2, pointRadius:0, tension:.2 },
      { label:'Power-law fair value', data:val('fair'), borderColor:'rgba(247,147,26,.9)', borderWidth:1.8, borderDash:[6,4], pointRadius:0, tension:.2 },
      { label:'Price', data:val('price'), borderColor:'#2f6fb0', borderWidth:2.4, pointRadius:0, tension:.2, spanGaps:false } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ mode:'index', intersect:false,
          filter:it=>['Price','Power-law fair value','Support'].includes(it.dataset.label),
          callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]), label:it=> it.parsed.y==null?null:it.dataset.label+' '+fmtUSD(it.parsed.y) } } },
        scales:{ x:baseOpts().scales.x, y:logY() } }), plugins:[watermark, windowShade, halvLines, botDots] });
    const L=B.latest;
    const when = L.bottom_confirmed ? 'both the price AND the clock now agree - this is the bottom window'
      : (L.in_zone ? 'price is <b>in the zone</b>, but the clock says wait: the bottom window opens in <b>'+L.days_to_window+' days</b> (Oct-Nov 2026)'
                   : 'price is <b>'+(L.spring<-1.5?'below the zone (deep capitulation)':'above the zone')+'</b>');
    setRead('Bitcoin is around <b>'+fmtUSD(L.price)+'</b>, about <b>'+L.drawdown_pct+'%</b> from its all-time high and well below its power-law fair value. So '+when+'. Every past cycle low (the teal dots) printed inside this green zone. A confirmed bottom needs the price in the zone AND the clock in the window. Right now we have the first, not yet the second.', L.in_zone);
    return ch; };

  R.rainbow = D => { const o=D.charts.rainbow, s=o.series, labels=s.map(d=>d.date), center=s.map(d=>d.center);
    const bandSets = o.bands.map((b,i)=>({ label:b.label, data:center.map(c=>c*b.mult), borderColor:'rgba(255,255,255,.14)', borderWidth:1, pointRadius:0,
      fill: i===0?'origin':'-1', backgroundColor:b.color+'cc', tension:.2 }));
    // Chart.js fills the band areas over later line datasets, so a normal price line gets buried.
    // Keep an invisible Price dataset for tooltips, and paint the visible black line (white halo) in afterDatasetsDraw so it sits on top.
    bandSets.push({ label:'Price', data:s.map(d=>d.price), borderColor:'rgba(0,0,0,0)', borderWidth:0, pointRadius:0 });
    const prices=s.map(d=>d.price);
    const rbLine={ id:'rbline', afterDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,y=ch.scales.y,g=ch.ctx; if(!a) return;
      g.save(); g.beginPath(); let started=false;
      for(let i=0;i<prices.length;i++){ if(prices[i]==null) continue; const px=x.getPixelForValue(i), py=y.getPixelForValue(prices[i]);
        if(!started){g.moveTo(px,py);started=true;} else g.lineTo(px,py); }
      g.lineJoin='round'; g.lineWidth=5; g.strokeStyle='rgba(255,255,255,.9)'; g.stroke();
      g.lineWidth=2.4; g.strokeStyle='#000'; g.stroke(); g.restore(); } };
    const ch=new Chart($('chart'), { type:'line', data:{ labels, datasets:bandSets },
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ filter:it=>it.dataset.label==='Price', callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]), label:it=>'Price '+fmtUSD(it.parsed.y) } } },
        scales:{ x:baseOpts().scales.x, y:logY() } }), plugins:[watermark, cycleMarks(D), rbLine] });
    setRead('Bitcoin is in the <b>"'+o.current_band+'"</b> band today. The rainbow is a fun, illustrative log-regression, not a model. Treat the colors as mood, not a signal.');
    const bl=$('bands'); if(bl) bl.innerHTML=o.bands.slice().reverse().map(b=>'<span class="ch-assume" style="border-color:'+b.color+'">'+b.label+'</span>').join(''); return ch; };

  R.ahr999 = D => { const ch=oscillator(D,'ahr999',{ field:'ahr999', name:'AHR999', cheap:0.45, hot:1.2, logLeft:true,
      cheapLabel:'bottom-fishing zone (0.45)', hotLabel:'above DCA cost (1.2)' });
    const v=D.charts.ahr999.latest, buy=v<0.45;
    setRead('Now at <b>'+v.toFixed(2)+'</b>. '+(buy?'Below 0.45, the historical bottom-fishing zone.':v<1.2?'In the dollar-cost-averaging zone (0.45 to 1.2).':'Above the DCA zone, historically richer.'), buy); return ch; };

  R.mstr = D => { const M=D.charts.mstr, s=M.series, labels=s.map(d=>d.date), cost=M.avg_cost;
    const ch=new Chart($('chart'), { type:'line', data:{ labels, datasets:[
      { label:'Strategy avg cost', data:s.map(()=>cost), borderColor:'rgba(154,167,189,.75)', borderWidth:1.4, borderDash:[6,4], pointRadius:0, yAxisID:'y', order:2 },
      { label:'BTC price', data:s.map(d=>d.price), borderWidth:2.4, pointRadius:0, tension:.15, yAxisID:'y', order:1,
        segment:{ borderColor:c=> c.p1.parsed.y>=cost ? '#4ec97a' : '#e2574a' } } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.dataset.label==='BTC price' ? 'BTC '+fmtUSD(it.parsed.y) : 'Avg cost '+fmtUSD(cost) } } },
        scales:{ x:baseOpts().scales.x, y:logY() } }), plugins:[watermark] });
    const mny=n=>{ const a=Math.abs(n); return (n<0?'-$':'$')+(a>=1e9?(a/1e9).toFixed(2)+'B':a>=1e6?(a/1e6).toFixed(1)+'M':Math.round(a).toLocaleString()); };
    const box=$('mstr_cards');
    if(box){ const up=M.pnl_usd>=0; const cards=[
      ['Bitcoin held', Math.round(M.holdings).toLocaleString()+' BTC', M.pct_supply+'% of all bitcoin', ''],
      ['Average cost', fmtUSD(M.avg_cost), 'per bitcoin, all buys', ''],
      ['Total invested', mny(M.cost_usd), 'cost basis', ''],
      ['Current value', mny(M.value_usd), 'at '+fmtUSD(M.btc_price)+' per BTC', ''],
      ['Unrealized '+(up?'profit':'loss'), mny(M.pnl_usd), (M.pnl_pct>=0?'+':'')+M.pnl_pct+'%', up?'up':'neg'],
      ['BTC price now', fmtUSD(M.btc_price), (M.btc_price>=M.avg_cost?'above':'below')+' the '+fmtUSD(M.avg_cost)+' avg cost', M.btc_price>=M.avg_cost?'up':'neg'] ];
      box.innerHTML = cards.map(c=>'<div class="ch-stat"><div class="l">'+c[0]+'</div><div class="n '+c[3]+'">'+c[1]+'</div><div class="s">'+c[2]+'</div></div>').join('')
        + '<p class="ch-hint" style="grid-column:1/-1;margin:2px 0 0">Holdings and cost basis via CoinGecko public-treasury data, as of '+fmtDate(M.as_of)+'. The price line is green when BTC traded above Strategy’s average cost, red when below.</p>'; }
    setRead('Strategy (formerly MicroStrategy) holds <b>'+Math.round(M.holdings).toLocaleString()+' BTC</b>, about <b>'+M.pct_supply+'%</b> of all the bitcoin that will ever exist, bought for <b>'+mny(M.cost_usd)+'</b> at an average of <b>'+fmtUSD(M.avg_cost)+'</b> each. At '+fmtUSD(M.btc_price)+' the stack is worth <b>'+mny(M.value_usd)+'</b>, '+(M.pnl_usd>=0?'an unrealized <b style="color:#4ec97a">profit</b> of ':'an unrealized <b style="color:#e2574a">loss</b> of ')+'<b>'+mny(Math.abs(M.pnl_usd))+'</b> ('+(M.pnl_pct>=0?'+':'')+M.pnl_pct+'%).', M.pnl_usd>=0); return ch; };

  R.halving_corr = D => { const H=D.charts.halving_corr, cyc=H.cycles; let curPhase='full'; const BB=H.bear_bottoms;
    const COL={'2012':'#5b9bd5','2016':'#a06cd5','2020':'#2dd4bf','2024':'#f7931a'};
    const ds=cyc.map(cy=>({ label:cy.name+(cy.current?' (now)':''), data:cy.path.map(p=>({x:p.day,y:p.roi})),
      borderColor:COL[cy.name]||'#9aa7bd', borderWidth:cy.current?3.4:1.8, pointRadius:0, tension:.15, order:cy.current?0:1 }));
    const tick={0:'Halving',365:'+1 yr',730:'+2 yr',1095:'+3 yr',1460:'+4 yr'};
    const today={ id:'tdl', afterDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,g=ch.ctx; if(!a) return; const px=x.getPixelForValue(H.current_day);
      if(px<a.left||px>a.right) return; g.save(); g.strokeStyle='rgba(232,237,246,.4)'; g.lineWidth=1; g.setLineDash([4,4]); g.beginPath(); g.moveTo(px,a.top); g.lineTo(px,a.bottom); g.stroke(); g.setLineDash([]);
      g.fillStyle=C.text; g.font='700 10px -apple-system,sans-serif'; g.textAlign='center'; g.fillText('we are here', px, a.top+11); g.restore(); } };
    const tops={ id:'tops', afterDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,y=ch.scales.y,g=ch.ctx; if(!a) return;
      cyc.forEach(cy=>{ const px=x.getPixelForValue(cy.top_day), py=y.getPixelForValue(cy.top_roi); if(px<a.left||px>a.right) return;
        g.beginPath(); g.arc(px,py,3.6,0,7); g.fillStyle=COL[cy.name]||'#9aa7bd'; g.fill(); g.lineWidth=1.2; g.strokeStyle='#0b0e14'; g.stroke(); }); } };
    const bottomBox={ id:'bbox', afterDatasetsDraw(ch){ if(curPhase!=='bottom'||!BB) return; const a=ch.chartArea,x=ch.scales.x,y=ch.scales.y,g=ch.ctx; if(!a) return;
      const cx=x.getPixelForValue(H.current_day), cyp=y.getPixelForValue(cyc.find(c=>c.current).path.slice(-1)[0].roi);
      const x0=x.getPixelForValue(BB.proj_day.min), x1=x.getPixelForValue(BB.proj_day.max), yT=y.getPixelForValue(BB.proj_roi.shallow), yB=y.getPixelForValue(BB.proj_roi.deep);
      g.save(); g.strokeStyle='rgba(78,201,122,.4)'; g.setLineDash([2,4]); g.lineWidth=1.5; g.beginPath(); g.moveTo(cx,cyp); g.lineTo((x0+x1)/2,(yT+yB)/2); g.stroke();
      g.fillStyle='rgba(78,201,122,.13)'; g.strokeStyle='rgba(78,201,122,.6)'; g.lineWidth=1; g.setLineDash([4,3]); g.fillRect(x0,yT,x1-x0,yB-yT); g.strokeRect(x0,yT,x1-x0,yB-yT); g.setLineDash([]);
      g.fillStyle='#4ec97a'; g.font='700 10px -apple-system,sans-serif'; g.textAlign='center'; g.textBaseline='bottom'; g.fillText('where past bears bottomed', (x0+x1)/2, yT-5); g.restore(); } };
    const ch=new Chart($('chart'), { type:'line', data:{ datasets:ds },
      options: baseOpts({ interaction:{mode:'nearest',intersect:false},
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>'Day '+it[0].parsed.x+' ('+(it[0].parsed.x/30.4).toFixed(1)+' months in)', label:it=>it.dataset.label+' '+it.parsed.y.toFixed(2)+'x' } } },
        scales:{ x:{ type:'linear', grid:{display:false}, min:0, max:1460, afterBuildTicks:ax=>{ ax.ticks=[0,365,730,1095,1460].map(v=>({value:v})); }, ticks:{ color:C.muted, font:{size:12}, callback:v=>tick[v]||'' } },
          y:{ type:'logarithmic', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>[0.5,1,2,5,10,25,50,100].includes(v)?v+'x':''}, title:{display:true,text:'return since the halving',color:C.muted,font:{size:11}} } } }),
      plugins:[watermark, today, tops, bottomBox] });
    const bearWeeks=Math.round((H.current_day-H.current_top_day)/7);
    const peak=n=>{ const cy=cyc.find(c=>c.name===n); return cy?cy.top_roi:0; };
    const roiNow=cyc.find(c=>c.current).path.slice(-1)[0].roi;
    const wk=d=>Math.round(d/7);
    const cards=list=>{ const box=$('corr_cards'); if(!box) return;
      if(!list||!list.length){ box.innerHTML='<p class="ch-hint" style="grid-column:1/-1;margin:0">This phase has not started yet for the current cycle.</p>'; return; }
      box.innerHTML=list.map((c,i)=>'<div class="ch-stat'+(i===0?' up':'')+'"><div class="l">vs the '+c.name+' cycle</div><div class="n">'+c.r.toFixed(2)+'</div><div class="s">'+(i===0?'closest match':'correlation')+' &middot; '+c.weeks+' weeks</div></div>').join(''); };
    const bottomCards=()=>{ const box=$('corr_cards'); if(!box) return; if(!BB){ box.innerHTML=''; return; }
      const c=[['Typical bear drop', BB.depth.med+'%', 'from '+BB.depth.max+'% to '+BB.depth.min+'%', false],
        ['Typical bear length', wk(BB.length.med)+' weeks', wk(BB.length.min)+' to '+wk(BB.length.max)+' weeks to the low', false],
        ['This cycle so far', BB.current.depth_pct+'%', wk(BB.current.days_since_top)+' weeks into the decline', true]];
      box.innerHTML=c.map(x=>'<div class="ch-stat'+(x[3]?' up':'')+'"><div class="l">'+x[0]+'</div><div class="n">'+x[1]+'</div><div class="s">'+x[2]+'</div></div>').join(''); };
    const reads={
      full: ()=>'Across the whole cycle so far, this one is up roughly <b>'+roiNow.toFixed(2)+'x</b> from its halving, the most muted cycle yet (past cycles peaked near <b>'+Math.round(peak('2012'))+'x</b>, '+Math.round(peak('2016'))+'x and '+Math.round(peak('2020'))+'x). Its overall path correlates most with the <b style="color:'+(COL[H.closest]||C.orange)+'">'+H.closest+' cycle (r = '+H.closest_r.toFixed(2)+')</b>. Use the buttons to split it into the bull run-up, the bear decline, and where past bears bottomed.',
      bull: ()=>{ const l=(H.corr_bull||[])[0]; return 'The <b>bull</b> phase runs from the halving up to the cycle top (the dots). This cycle topped about <b>'+(H.current_top_day/30.4).toFixed(1)+' months</b> in, at roughly '+H.current_top_roi.toFixed(2)+'x. '+(l?'Its run-up shape most resembles the <b style="color:'+(COL[l.name]||C.orange)+'">'+l.name+' bull (r = '+l.r.toFixed(2)+')</b>.':''); },
      bear: ()=>{ const l=(H.corr_bear||[])[0]; return l ? 'The <b>bear</b> phase is the decline from the cycle top. This cycle is <b>'+bearWeeks+' weeks</b> into its drawdown, and that partial decline most resembles the <b style="color:'+(COL[l.name]||C.orange)+'">'+l.name+' bear (r = '+l.r.toFixed(2)+')</b>. It is not finished, so this compares the drop so far against past drops at the same age.' : 'This cycle has not topped yet, so the bear phase has not begun.'; },
      bottom: ()=>{ if(!BB) return 'Not enough completed cycles to project a bottom.'; return 'In the three past cycles the bear fell between <b>'+BB.depth.max+'%</b> and <b>'+BB.depth.min+'%</b> from the top and took <b>'+wk(BB.length.min)+' to '+wk(BB.length.max)+' weeks</b> to reach the low. This cycle is <b>'+wk(BB.current.days_since_top)+' weeks</b> in and down <b>'+BB.current.depth_pct+'%</b>. If it rhymed with those, the low would land in the shaded zone. But the sample is only <b>three</b> bears, the drawdowns have been shrinking each cycle, and this cycle is far more muted, so read it as a rough historical range, not a forecast. For the actual timing model, see the <a href="/cycle/">Satoshi Clock</a>.'; } };
    const show=ph=>{ curPhase=ph;
      if(ph==='bottom') bottomCards(); else cards(ph==='bull'?H.corr_bull:ph==='bear'?H.corr_bear:H.corr);
      setRead(reads[ph]());
      ch.options.scales.y.min = (ph==='bottom' && BB) ? Math.max(0.1, BB.proj_roi.deep*0.8) : undefined; ch.update('none');
      const tg=$('phase_toggle'); if(tg) tg.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.ph===ph)); };
    const tg=$('phase_toggle'); if(tg) tg.querySelectorAll('button').forEach(b=>b.onclick=()=>show(b.dataset.ph));
    show('full'); return ch; };

  R.mvrv_z = D => { const ch=oscillator(D,'mvrv_z',{ field:'z', name:'MVRV Z-Score', cheap:0.1, hot:7,
      cheapLabel:'bottom zone (0)', hotLabel:'top zone (7)', min:-1, max:10 });
    const z=D.charts.mvrv_z.latest;
    setRead('The MVRV Z-Score is <b>'+z.toFixed(2)+'</b>. It measures how far Bitcoin’s market value has stretched above what the market paid, in standard deviations. Readings above about <b>7</b> have marked cycle tops, and readings near or below <b>0</b> have marked bottoms. '+(z>=7?'That is up in the historic top zone.':z<=0.5?'That is down in the historic bottom zone.':'Right now it sits in the middle of its range.'), z<=0.5); return ch; };

  R.volatility = D => { const s=D.charts.volatility.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line', data:{ labels, datasets:[ priceOverlay(s.map(d=>d.price)),
      { label:'90-day volatility', data:s.map(d=>d.vol90), borderColor:'rgba(45,212,191,.7)', borderWidth:1.6, pointRadius:0, tension:.2, yAxisID:'y', order:2 },
      { label:'30-day volatility', data:s.map(d=>d.vol30), borderColor:C.orange, borderWidth:1.8, pointRadius:0, tension:.2, yAxisID:'y', order:1 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.datasetIndex===0 ? 'BTC '+fmtUSD(it.parsed.y) : it.dataset.label+' '+Math.round(it.parsed.y)+'%' } } },
        scales:{ x:baseOpts().scales.x, y:{ position:'left', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v+'%'}, suggestedMin:0 }, y2:priceAxis() } }),
      plugins:[watermark, cycleMarks(D)] });
    const l=D.charts.volatility.latest;
    setRead('Bitcoin’s annualized volatility is about <b>'+Math.round(l.vol30)+'%</b> over the last 30 days ('+Math.round(l.vol90)+'% over 90 days). The long-run trend has been downward. Each cycle it swings a little less wildly as the asset grows, the same maturation you see across these charts.'); return ch; };

  R.hashrate = D => { const s=D.charts.hashrate.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line', data:{ labels, datasets:[ priceOverlay(s.map(d=>d.price)),
      { label:'Hash rate', data:s.map(d=>d.hashrate), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15, yAxisID:'y', order:1 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.datasetIndex===0 ? 'BTC '+fmtUSD(it.parsed.y) : 'Hash rate '+(it.parsed.y>=1?Math.round(it.parsed.y).toLocaleString():it.parsed.y.toFixed(2))+' EH/s' } } },
        scales:{ x:baseOpts().scales.x, y:{ type:'logarithmic', position:'left', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>[0.001,0.01,0.1,1,10,100,1000].includes(v)?(v>=1?v+' EH':v+' EH'):''} }, y2:priceAxis() } }),
      plugins:[watermark, cycleMarks(D)] });
    const l=D.charts.hashrate.latest;
    setRead('Bitcoin’s network hash rate is about <b>'+Math.round(l.hashrate).toLocaleString()+' EH/s</b>'+(l.hashrate>=l.ath*0.98?', at or near an all-time high':'')+'. More hash rate means more computing power defending the chain, so the network is harder and more expensive to attack. It has climbed relentlessly through every price crash.', true); return ch; };

  R.hash_ribbons = D => { const o=D.charts.hash_ribbons;
    // The 30d and 60d hash-rate MAs sit within ~1px of each other on a log axis, so the signal is invisible as two
    // lines. Plot their RATIO (30d/60d) as an oscillator around 1.0: below 1 = capitulation, above 1 = healthy.
    const s=o.series.filter(d=> d.date>='2014-01-01' && d.ma30!=null && d.ma60), labels=s.map(d=>d.date), ratio=s.map(d=>d.ma30/d.ma60);
    const capShade={ id:'cap', beforeDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,g=ch.ctx; if(!a) return; g.save(); g.fillStyle='rgba(226,87,74,.10)';
      for(let i=1;i<ratio.length;i++){ if(ratio[i]<1){ const x0=x.getPixelForValue(i-1), x1=x.getPixelForValue(i); g.fillRect(x0,a.top,x1-x0,a.bottom-a.top); } } g.restore(); } };
    const baseLine={ id:'bl', afterDatasetsDraw(ch){ const a=ch.chartArea,y=ch.scales.y,g=ch.ctx; if(!a) return; const py=y.getPixelForValue(1);
      g.save(); g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(a.left,py); g.lineTo(a.right,py); g.stroke();
      g.font='700 10px -apple-system,sans-serif'; g.textBaseline='bottom'; g.textAlign='right'; g.fillStyle='rgba(78,201,122,.9)'; g.fillText('above = miners healthy', a.right-6, py-3);
      g.textBaseline='top'; g.fillStyle='rgba(226,87,74,.9)'; g.fillText('below = miners capitulating', a.right-6, py+3);
      g.textAlign='left'; g.fillStyle=C.muted; g.textBaseline='bottom'; g.fillText('30d = 60d', a.left+4, py-3); g.restore(); } };
    const buyDots={ id:'buy', afterDatasetsDraw(ch){ const a=ch.chartArea,x=ch.scales.x,y=ch.scales.y,g=ch.ctx; if(!a) return;
      for(let i=1;i<ratio.length;i++){ if(ratio[i-1]<1 && ratio[i]>=1){ const px=x.getPixelForValue(i), py=y.getPixelForValue(ratio[i]); if(px<a.left||px>a.right) continue;
        g.save(); g.fillStyle='#4ec97a'; g.strokeStyle='#0b0e14'; g.lineWidth=1.5; g.beginPath(); g.arc(px,py,4,0,7); g.fill(); g.stroke(); g.restore(); } } } };
    const ch=new Chart($('chart'), { type:'line', data:{ labels, datasets:[ priceOverlay(s.map(d=>d.price)),
      { label:'30d / 60d hash rate', data:ratio, borderWidth:2.4, pointRadius:0, tension:.15, yAxisID:'y', order:1,
        segment:{ borderColor:c=> c.p1.parsed.y>=1 ? '#4ec97a' : '#e2574a' },
        fill:{ target:{value:1}, above:'rgba(78,201,122,.10)', below:'rgba(226,87,74,.18)' } } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.datasetIndex===0 ? 'BTC '+fmtUSD(it.parsed.y) : '30d/60d '+it.parsed.y.toFixed(3)+(it.parsed.y<1?' (capitulation)':'') } } },
        scales:{ x:baseOpts().scales.x, y:{ position:'left', grid:{color:C.line}, min:0.8, suggestedMax:1.15, ticks:{color:C.muted,font:{size:12},callback:v=>v.toFixed(2)} }, y2:priceAxis() } }),
      plugins:[watermark, capShade, baseLine, buyDots] });
    const cur=ratio[ratio.length-1];
    setRead('This is the ratio of the <b>30-day</b> to the <b>60-day</b> hash-rate average. When it drops <b style="color:#e2574a">below 1.0</b> (the red zone) the 30-day has fallen under the 60-day, meaning miners are switching machines off, which has clustered near price bottoms. The <b style="color:#4ec97a">green dots</b> mark the recovery cross back above 1.0, historically a good long-term buy. Right now the ratio is <b>'+cur.toFixed(3)+'</b>, so '+(o.latest.capitulating?'miners are <b style="color:#e2574a">capitulating</b>.':'miners are <b style="color:#4ec97a">healthy</b>.'), !o.latest.capitulating); return ch; };

  R.active_addresses = D => { const s=D.charts.active_addresses.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line', data:{ labels, datasets:[ priceOverlay(s.map(d=>d.price)),
      { label:'Active addresses', data:s.map(d=>d.active), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15, yAxisID:'y', order:1 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.datasetIndex===0 ? 'BTC '+fmtUSD(it.parsed.y) : Math.round(it.parsed.y).toLocaleString()+' active addresses' } } },
        scales:{ x:baseOpts().scales.x, y:{ position:'left', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v>=1e6?(v/1e6).toFixed(1)+'M':Math.round(v/1e3)+'k'} }, y2:priceAxis() } }),
      plugins:[watermark, cycleMarks(D)] });
    const l=D.charts.active_addresses.latest;
    setRead('About <b>'+Math.round(l).toLocaleString()+'</b> Bitcoin addresses are active on an average day. It is a rough gauge of how many people are actually using the network, and over the long run it has broadly risen and fallen with price.', true); return ch; };

  R.supply = D => { const s=D.charts.supply.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line', data:{ labels, datasets:[
      { label:'Supply', data:s.map(d=>d.supply), borderColor:'rgba(154,167,189,.7)', borderWidth:1.6, pointRadius:0, tension:.1, yAxisID:'y2', order:2 },
      { label:'Inflation rate', data:s.map(d=>d.inflation), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.1, yAxisID:'y', order:1 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.dataset.label==='Supply' ? 'Supply '+it.parsed.y.toFixed(2)+'M BTC' : 'Inflation '+it.parsed.y.toFixed(2)+'% a year' } } },
        scales:{ x:baseOpts().scales.x, y:{ position:'left', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v+'%'}, suggestedMin:0 },
          y2:{ position:'right', grid:{display:false}, min:0, max:21, ticks:{color:'rgba(154,167,189,.75)',font:{size:11},callback:v=>v+'M'} } } }),
      plugins:[watermark, halvingLines(D)] });
    const l=D.charts.supply.latest;
    setRead('New bitcoin is created at about <b>'+l.inflation.toFixed(2)+'%</b> a year, and <b>'+l.pct_mined+'%</b> of the eventual 21 million have already been mined. Every four years the halving cuts new issuance in half, which is why the orange inflation line steps down while the grey supply line flattens toward the 21 million cap.', true); return ch; };

  R.fng = D => { const o=D.charts.fng, s=o.series, labels=s.map(d=>d.date), col=fngColor(o.latest);
    drawFngGauge(o.latest);
    const num=$('fng-num'), cls=$('fng-cls');
    if(num){ num.textContent=o.latest; num.style.color=col; }
    if(cls){ cls.textContent=o.classification.replace(/\b\w/g,m=>m.toUpperCase()); cls.style.color=col; }
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[ priceOverlay(s.map(d=>d.price)),
        { label:'Fear & Greed', data:s.map(d=>d.fng), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15, yAxisID:'y', order:1,
          segment:{ borderColor:c=>fngColor(c.p1.parsed.y) } }] },
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.datasetIndex===0 ? 'BTC '+fmtUSD(it.parsed.y) : 'Fear & Greed '+it.parsed.y } } },
        scales:{ x:baseOpts().scales.x, y:{ position:'left', grid:{color:C.line}, min:0, max:100, ticks:{color:C.muted,font:{size:12}} }, y2:priceAxis() } }),
      plugins:[watermark, thresholds([{v:25,c:'#e2574a',t:'extreme fear'},{v:75,c:'#2ea043',t:'extreme greed'}]), cycleMarks(D)] });
    setRead('Extreme fear (under 25) has clustered around cycle bottoms, extreme greed (over 75) around tops. A contrarian read.', o.latest<=25); return ch; };

  R.altseason = D => { const M=D.charts.altseason, co=M.coins||[], labels=co.map(c=>c.sym);
    const win=M.window||'30-day', is90=win==='90-day', val=c=>is90?c.chg90:c.chg;
    drawFngGauge(M.index, 'alt-gauge');
    const col=fngColor(M.index), num=$('alt-num'), cls=$('alt-cls'), sub=$('alt-sub');
    if(num){ num.textContent=M.index; num.style.color=col; }
    if(cls){ cls.textContent=M.classification; cls.style.color=col; }
    const building=(!is90 && M.days_collected!=null) ? ' &middot; <span style="color:var(--muted)">building the 90-day index: '+M.days_collected+' of '+M.days_needed+' days collected</span>' : '';
    if(sub){ sub.innerHTML='<b>'+M.beat+' of '+M.total+'</b> top coins are beating Bitcoin over the last '+win.replace('-day',' days')+building; }
    const zeroLine={ id:'zl', afterDatasetsDraw(ch){ const a=ch.chartArea,y=ch.scales.y,g=ch.ctx; if(!a) return; const py=y.getPixelForValue(0);
      g.save();
      // corner guides so it's obvious the bars are measured against Bitcoin
      g.font='700 10px -apple-system,sans-serif'; g.textAlign='right';
      g.fillStyle='rgba(46,160,67,.9)'; g.textBaseline='top'; g.fillText('above the line = beat Bitcoin', a.right-6, a.top+4);
      g.fillStyle='rgba(226,87,74,.9)'; g.textBaseline='bottom'; g.fillText('below the line = lagged Bitcoin', a.right-6, a.bottom-4);
      // the bold orange Bitcoin baseline (0%)
      g.strokeStyle=C.orange; g.lineWidth=2.5; g.beginPath(); g.moveTo(a.left,py); g.lineTo(a.right,py); g.stroke();
      g.font='800 11px -apple-system,sans-serif'; const lbl='BITCOIN  0%', lw=g.measureText(lbl).width;
      g.fillStyle='#0b0e14'; g.fillRect(a.left, py-15, lw+12, 15);
      g.fillStyle=C.orange; g.textAlign='left'; g.textBaseline='bottom'; g.fillText(lbl, a.left+6, py-3);
      g.restore(); } };
    const ch=new Chart($('chart'), { type:'bar', data:{ labels, datasets:[
      { label:win+' vs BTC', data:co.map(c=>val(c)), backgroundColor:co.map(c=>val(c)>=0?'rgba(46,160,67,.85)':'rgba(226,87,74,.85)'), borderWidth:0 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>labels[it[0].dataIndex], label:it=>(it.parsed.y>=0?'+':'')+it.parsed.y+'% vs BTC ('+win+')' } } },
        scales:{ x:{ grid:{display:false}, ticks:{color:C.muted,font:{size:9},maxRotation:90,minRotation:90,autoSkip:false} },
          y:{ grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>(v>=0?'+':'')+v+'%'} } } }),
      plugins:[watermark, zeroLine] });
    setRead('The Altcoin Season Index is <b>'+M.index+'/100</b> ('+M.classification+'). It is the share of the top '+M.total+' coins beating Bitcoin over the last '+win.replace('-day',' days')+': above 75 is altcoin season, below 25 is Bitcoin season. Each green bar is a coin that beat Bitcoin, each red bar one that lagged it.'+(!is90?' We are collecting daily prices to turn this into a true 90-day index ('+M.days_collected+'/'+M.days_needed+' days so far).':''), M.index>=75); return ch; };

  // Altseason Compass: split chart -> altcoin market cap (TOTAL3) on top, the 0-100 score oscillator below
  const compassColor = v => v>=70?'#2ea043':v>=50?'#8cc84b':v>30?'#f0883e':'#e2574a';
  const t3tick = v => v>=1e12?'$'+(v/1e12).toFixed(1)+'T':v>=1e9?'$'+Math.round(v/1e9)+'B':'$'+Math.round(v/1e6)+'M';
  R.compass = D => { const o=D.charts.compass; if(!o) return null; const s=o.series, labels=s.map(d=>d.date), L=o.latest;
    const yW = sc => { sc.width = 58; }, pad = { padding:{ right:14, top:4 } };
    const top = new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[{ label:'Altcoin market cap', data:s.map(d=>d.total3), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15 }] },
      options: baseOpts({ layout:pad, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]), label:it=>'Alts (TOTAL3) '+t3tick(it.parsed.y) } } },
        scales:{ x:{ grid:{display:false}, ticks:{display:false} },
          y:{ type:'logarithmic', position:'left', grid:{color:C.line}, afterFit:yW, ticks:{color:C.muted,font:{size:12},callback:t3tick} } } }),
      plugins:[watermark, cycleMarks(D)] });
    const bot = new Chart($('chart2'), { type:'line',
      data:{ labels, datasets:[{ label:'Altseason score', data:s.map(d=>d.score), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15,
        segment:{ borderColor:c=>compassColor(c.p1.parsed.y) }, fill:{ target:{value:50}, above:'rgba(46,160,67,.15)', below:'rgba(226,87,74,.13)' } }] },
      options: baseOpts({ layout:pad, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]), label:it=>'Altseason score '+Math.round(it.parsed.y) } } },
        scales:{ x:baseOpts().scales.x, y:{ position:'left', min:0, max:100, grid:{color:C.line}, afterFit:yW, ticks:{color:C.muted,font:{size:12}} } } }),
      plugins:[cycleMarks(D), thresholds([{v:70,c:'#2ea043',t:'alt season'},{v:30,c:'#e2574a',t:'bitcoin season'}])] });
    BDCharts.chart2 = bot;
    setRead('The compass reads <b>'+L.phase+'</b> at <b>'+Math.round(L.score)+'/100</b>. Bitcoin dominance is '+(L.btcd_up?'rising':'falling')+' ('+L.btcd+'%), BTC price is '+(L.price_up?'rising':'falling')+', and ETH/BTC is '+(L.ethbtc_up?'rising (ETH leading)':'falling (ETH lagging)')+'. Alt season is confirmed only when all three line up (dominance falling, price rising, ETH leading); when dominance and price are favorable but ETH is not confirming yet, it reads Alt setup. Top panel is the altcoin market cap (TOTAL3).', L.phase==='Alt season');
    return top; };

  R.ma2y = D => { const s=D.charts.ma2y.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'2yr MA x5', data:s.map(d=>d.ma2y5), borderColor:C.red, borderWidth:1.6, borderDash:[5,4], pointRadius:0, tension:.2 },
        { label:'2yr MA', data:s.map(d=>d.ma2y), borderColor:C.teal, borderWidth:2, pointRadius:0, tension:.2 },
        { label:'Price', data:s.map(d=>d.price), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.2 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>['2x 2yr MA (sell)','2yr MA (buy)','Price'][it.datasetIndex]+' '+fmtUSD(it.parsed.y) } } }, scales:{ x:baseOpts().scales.x, y:logY() } }), plugins:[watermark, cycleMarks(D)] });
    const l=D.charts.ma2y.latest; setRead('Price is <b>'+l.mult.toFixed(2)+'x</b> its 2-year moving average of '+fmtUSD(l.ma2y)+'. '+(l.mult<1?'Below the 2-year average has historically been an accumulation zone.':'Above the 2-year average. The red line (5x) has marked cycle tops.'), l.mult<1); return ch; };

  R.drawdown = D => { const cy=D.charts.drawdown.cycles;
    const ch=new Chart($('chart'), { type:'line',
      data:{ datasets: cy.map(c=>({ label:c.label, data:c.path.map(p=>({x:p.d,y:p.dd})), borderColor:c.color,
        borderWidth:c.current?3:1.6, pointRadius:0, tension:.1, order:c.current?0:1 })) },
      options: baseOpts({ plugins:{ legend:{display:true, labels:{color:C.muted, boxWidth:14, font:{size:12}}},
        tooltip:{ callbacks:{ title:it=>'Day '+it[0].parsed.x+' after the top', label:it=>it.dataset.label+': '+it.parsed.y.toFixed(1)+'%' } } },
        scales:{ x:{ type:'linear', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v+'d'},
                     title:{display:true, text:'Days since the cycle top', color:C.muted, font:{size:12}} },
                 y:{ grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v+'%'}, suggestedMin:-90, suggestedMax:8 } } }),
      plugins:[watermark] });
    const n=D.charts.drawdown.now; setRead('This cycle is <b>'+n.days+' days</b> past its top and <b>'+n.dd+'%</b> below it. Compare the orange line to how deep and how long past drawdowns ran before the bottom.', n.dd>-55); return ch; };

  R.cycle_band = D => { const o=D.charts.cycle_band, b=o.band, cur=o.current;
    const ch=new Chart($('chart'), { type:'line',
      data:{ datasets:[
        { label:'Range high', data:b.map(p=>({x:p.d,y:p.hi})), borderColor:'rgba(154,167,189,.35)', borderWidth:1, pointRadius:0, tension:.25, fill:'+1', backgroundColor:'rgba(154,167,189,.15)' },
        { label:'Range low', data:b.map(p=>({x:p.d,y:p.lo})), borderColor:'rgba(154,167,189,.35)', borderWidth:1, pointRadius:0, tension:.25 },
        { label:'Average bear', data:b.map(p=>({x:p.d,y:p.avg})), borderColor:C.teal, borderWidth:1.8, borderDash:[6,4], pointRadius:0, tension:.25 },
        { label:'This cycle', data:cur.map(p=>({x:p.d,y:p.mult})), borderColor:C.orange, borderWidth:3, pointRadius:0, tension:.15, order:0 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ mode:'nearest', intersect:false, callbacks:{ title:it=>'Day '+it[0].parsed.x+' after the top',
          label:it=>['Range high','Range low','Average bear','This cycle'][it.datasetIndex]+': '+it.parsed.y.toFixed(2)+'x the top' } } },
        scales:{ x:{ type:'linear', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v+'d'},
                     title:{display:true, text:'Days since the cycle top', color:C.muted, font:{size:12}} },
                 y:{ grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v.toFixed(2)+'x'}, suggestedMin:0.2, suggestedMax:1.25 } } }),
      plugins:[watermark] });
    const n=o.now; setRead('At <b>day '+n.day+'</b> of the bear, this cycle sits at <b>'+n.mult.toFixed(2)+'x</b> the top. Every past cycle (2013, 2017, 2021) was between '+n.lo.toFixed(2)+'x and '+n.hi.toFixed(2)+'x at this point, so we are <b>'+n.pos+'</b>.', n.mult>=n.avg); return ch; };

  R.miner_cost = D => { const s=D.charts.miner_cost.series, labels=s.map(d=>d.date), a=D.charts.miner_cost.assumptions;
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'hi', data:s.map(d=>d.hi), borderColor:'transparent', pointRadius:0, fill:'+1', backgroundColor:'rgba(45,212,191,.16)' },
        { label:'lo', data:s.map(d=>d.lo), borderColor:'transparent', pointRadius:0 },
        { label:'Estimated cost', data:s.map(d=>d.cost), borderColor:C.teal, borderWidth:2, pointRadius:0, tension:.2 },
        { label:'Price', data:s.map(d=>d.price), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.2 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ filter:it=>it.datasetIndex>=2, callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>(it.datasetIndex===3?'Price ':'Est. cost ')+fmtUSD(it.parsed.y) } } }, scales:{ x:baseOpts().scales.x, y:logY() } }), plugins:[watermark, cycleMarks(D)] });
    const l=D.charts.miner_cost.latest;
    setRead('Estimated cost to mine one Bitcoin is about <b>'+fmtUSD(l.cost)+'</b>, so price is roughly '+l.price_to_cost.toFixed(2)+'x the electricity cost.');
    const as=$('assume'); if(as) as.innerHTML='<span class="ch-assume">Efficiency '+a.efficiency_j_th+' J/TH (range '+a.eff_band[0]+' to '+a.eff_band[1]+')</span><span class="ch-assume">Power $'+a.electricity_usd_kwh+'/kWh (range $'+a.elec_band[0]+' to $'+a.elec_band[1]+')</span>'; return ch; };

  R.m2_vs_btc = D => { const o=D.charts.m2_vs_btc, s=o.series, labels=s.map(d=>d.date);
    setCorrStats([ {num:sign(o.corr_yoy), label:'12-month correlation with the money supply', color:C.teal},
                   {num:'$'+o.m2_latest_t+'T', label:'US M2 money supply today'} ]);
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'M2', data:s.map(d=>d.m2), borderColor:C.teal, borderWidth:2, pointRadius:0, tension:.25, yAxisID:'y2' },
        { label:'BTC', data:s.map(d=>d.btc), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.25, yAxisID:'y' } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>it.datasetIndex===1?'BTC '+fmtUSD(it.parsed.y):'M2 $'+(it.parsed.y/1000).toFixed(1)+'T' } } },
        scales:{ x:baseOpts().scales.x, y:logY(), y2:{ position:'right', grid:{display:false}, ticks:{color:C.teal,font:{size:12},callback:v=>'$'+(v/1000).toFixed(0)+'T'} } } }), plugins:[watermark, agreeShade(s), cycleMarks(D)] });
    setRead('US M2 is about <b>$'+D.charts.m2_vs_btc.m2_latest_t+' trillion</b>. Green shading marks months they moved the same direction, red marks opposite. Year-over-year correlation is '+D.charts.m2_vs_btc.corr_yoy+', a real but loose link.'); return ch; };

  R.pmi_vs_btc = D => { const o=D.charts.pmi_vs_btc, s=o.series, labels=s.map(d=>d.date);
    setCorrStats([ {num:sign(o.corr_mom), label:'correlation of monthly moves with PMI (effectively zero)', color:C.blue},
                   {num:sign(o.corr_level), label:'correlation of the levels'} ]);
    const yW = sc => { sc.width = 62; };  // fix both panels' left-axis width so the two timelines line up
    const pad = { padding:{ right:14, top:4 } };
    const top = new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[{ label:'Bitcoin price', data:s.map(d=>d.btc), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15 }] },
      options: baseOpts({ layout:pad, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]), label:it=>'BTC '+fmtUSD(it.parsed.y) } } },
        scales:{ x:{ grid:{display:false}, ticks:{display:false} },
          y:{ type:'logarithmic', position:'left', grid:{color:C.line}, afterFit:yW, ticks:{color:C.muted,font:{size:12},callback:logTick} } } }),
      plugins:[watermark, halvingLines(D), cycleTris(D,s)] });
    const bot = new Chart($('chart2'), { type:'line',
      data:{ labels, datasets:[{ label:'PMI', data:s.map(d=>d.pmi), borderColor:C.blue, borderWidth:2, pointRadius:0, tension:.25,
        fill:{ target:{value:50}, above:'rgba(78,201,122,.28)', below:'rgba(226,87,74,.26)' } }] },
      options: baseOpts({ layout:pad, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]), label:it=>'PMI '+it.parsed.y.toFixed(1) } } },
        scales:{ x:baseOpts().scales.x, y:{ position:'left', grid:{color:C.line}, min:35, max:68, afterFit:yW, ticks:{color:C.muted,font:{size:12}} } } }),
      plugins:[halvingLines(D), pmi50line] });
    BDCharts.chart2 = bot;
    setRead('Top: Bitcoin price with its cycle tops, bottoms and halvings. Bottom: the economy (ISM PMI), green above 50 (expanding), red below (shrinking). The monthly moves barely relate (correlation <b>'+sign(o.corr_mom)+'</b>). Bitcoin has run full bull markets while the economy was shrinking.', false);
    return top; };

  R.sp500_vs_btc = D => { const o=D.charts.sp500_vs_btc, y=o.years, labels=y.map(d=>String(d.year)), vals=y.map(d=>d.corr);
    setCorrStats([ {num:o.full_avg.toFixed(2), label:'average correlation with the S&P 500', color:C.orange},
                   {num:o.claim.toFixed(2), label:'the number people quote', cls:'myth'} ]);
    const ch=new Chart($('chart'), { type:'bar', data:{ labels, datasets:[{ data:vals, backgroundColor:y.map(d=>d.year<2020?C.teal:C.orange), borderRadius:3 }] },
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>it[0].label, label:it=>'Correlation '+it.parsed.y.toFixed(2) } } },
        scales:{ x:{ grid:{display:false}, ticks:{color:C.muted,font:{size:12}} }, y:{ grid:{color:C.line}, ticks:{color:C.muted,font:{size:12}}, suggestedMin:-0.25, suggestedMax:1 } } }),
      plugins:[watermark, thresholds([{v:D.charts.sp500_vs_btc.claim,c:C.red,t:'the "0.87" claim'},{v:D.charts.sp500_vs_btc.full_avg,c:C.muted,t:'full-period average '+D.charts.sp500_vs_btc.full_avg}])] });
    setRead('The full-period average correlation is <b>'+D.charts.sp500_vs_btc.full_avg+'</b>, not the 0.87 people quote. It even goes negative in some years.'); return ch; };

  R.metcalfe = D => { const s=D.charts.metcalfe.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[ priceOverlay(s.map(d=>d.price)),
        { label:'Price to Metcalfe', data:s.map(d=>d.ratio), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.15, yAxisID:'y', order:1,
          segment:{ borderColor:c=>{const y=c.p1.parsed.y; return y>=200?C.red:y<=60?C.teal:C.orange;} } }] },
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.datasetIndex===0?'BTC '+fmtUSD(it.parsed.y):'Price/Metcalfe '+Math.round(it.parsed.y)+'%' } } },
        scales:{ x:baseOpts().scales.x, y:{ type:'logarithmic', position:'left', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>[20,40,60,100,200,400].includes(v)?v+'%':''} }, y2:priceAxis() } }),
      plugins:[watermark, thresholds([{v:100,c:C.muted,t:'fair value (100%)'}]), cycleMarks(D)] });
    const v=D.charts.metcalfe.latest; setRead('Now at <b>'+Math.round(v)+'%</b> of its 2-year network-value trend. Below 100 means price is cheap versus on-chain activity (active addresses), above means rich. Metcalfe law, network value grows with users squared.', v<100); return ch; };

  R.sentiment = D => { const s=D.charts.sentiment.series, labels=s.map(d=>d.date);
    const zone=i=>{ const p=s[i]; if(!p||p.pc==null||p.hi==null) return C.blue; return p.pc>=p.hi?C.red:(p.pc<=p.lo?'#4ec97a':C.blue); };
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'hi', data:s.map(d=>d.hi), borderColor:'transparent', pointRadius:0, fill:'+1', backgroundColor:'rgba(154,167,189,.10)', tension:.1 },
        { label:'lo', data:s.map(d=>d.lo), borderColor:'transparent', pointRadius:0, tension:.1 },
        { label:'Active addresses', data:s.map(d=>d.ac), borderColor:'rgba(154,167,189,.32)', borderWidth:1, pointRadius:0, tension:.35 },
        { label:'Price', data:s.map(d=>d.pc), borderColor:C.blue, borderWidth:2.8, pointRadius:0, tension:.2, order:0, segment:{ borderColor:c=>zone(c.p1.dataIndex) } } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ filter:it=>it.datasetIndex>=2, callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>(it.datasetIndex===3?'Price 30d':'Active addresses 30d')+': '+(it.parsed.y>=0?'+':'')+it.parsed.y.toFixed(1)+'%' } } },
        scales:{ x:baseOpts().scales.x, y:{ grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v+'%'} } } }),
      plugins:[watermark, cycleMarks(D)] });
    const l=D.charts.sentiment.latest; setRead('The bold line is Bitcoin’s 30-day price change. Inside the grey band is normal. It turns <b style="color:#e2574a">red</b> above the band (overheated) and <b style="color:#4ec97a">green</b> below it (oversold). The faint line is the 30-day change in active addresses.', l.pc<0); return ch; };

  function returnsTable(o, isQ){
    const cols = isQ?['Q1','Q2','Q3','Q4']:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const bg=v=>{ if(v==null) return 'transparent'; const a=(0.12+Math.min(1,Math.abs(v)/45)*0.5); return (v>=0?'rgba(78,201,122,':'rgba(226,87,74,')+a.toFixed(2)+')'; };
    const fmt=v=>v==null?'':(v>=0?'+':'')+v.toFixed(1)+'%';
    let h='<table class="ch-heat"><thead><tr><th>Year</th>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>';
    o.years.forEach(y=>{ const r=o.data[y]||{}; h+='<tr><td class="yr">'+y+'</td>'+cols.map((c,i)=>'<td style="background:'+bg(r[i+1])+'">'+fmt(r[i+1])+'</td>').join('')+'</tr>'; });
    h+='</tbody><tfoot><tr><td class="yr">Avg</td>'+cols.map((c,i)=>'<td class="st">'+fmt(o.avg[i+1])+'</td>').join('')+'</tr>'
      +'<tr><td class="yr">Median</td>'+cols.map((c,i)=>'<td class="st">'+fmt(o.median[i+1])+'</td>').join('')+'</tr></tfoot></table>';
    return h; }
  R.monthly_returns = D => { const el=$('returns_table'); if(!el) return null;
    const draw=isQ=>{ el.innerHTML=returnsTable(isQ?D.charts.quarterly_returns:D.charts.monthly_returns, isQ); };
    draw(false);
    const bm=$('btn_month'), bq=$('btn_qtr');
    if(bm) bm.onclick=()=>{ draw(false); bm.classList.add('active'); if(bq) bq.classList.remove('active'); };
    if(bq) bq.onclick=()=>{ draw(true); bq.classList.add('active'); if(bm) bm.classList.remove('active'); };
    return null; };

  R.etf_flows = D => { const E=D.charts.etf_flows, s=E.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { data:{ labels, datasets:[
      { type:'line', label:'Cumulative', data:s.map(d=>d.cum/1000), borderColor:C.orange, borderWidth:2.4, pointRadius:0, tension:.1, yAxisID:'y2', order:0 },
      { type:'bar', label:'Daily net flow', data:s.map(d=>d.net), backgroundColor:s.map(d=>d.net>=0?'rgba(78,201,122,.85)':'rgba(226,87,74,.85)'), borderWidth:0, yAxisID:'y', order:1 } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=> it.dataset.type==='line' ? 'Cumulative '+(it.parsed.y>=0?'+':'')+'$'+it.parsed.y.toFixed(2)+'B' : 'Net '+(it.parsed.y>=0?'+':'')+'$'+Math.round(it.parsed.y)+'m' } } },
        scales:{ x:{ grid:{display:false}, ticks:{ color:C.muted, font:{size:11}, maxTicksLimit:12, autoSkip:true, callback:function(i){ const l=this.getLabelForValue(i); return l?l.slice(5):''; } } },
                 y:{ grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>(v>=0?'+':'')+'$'+v+'m'} },
                 y2:{ position:'right', grid:{display:false}, ticks:{color:C.orange,font:{size:12},callback:v=>'$'+v+'B'} } } }),
      plugins:[watermark] });
    const l=E.latest, S=E.summary, n=s.length;
    const money=(n,dec)=>(n<0?'-$':'+$')+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:dec});
    // a $-millions figure -> compact value ($X.XXB for a billion+, else $Xm; a flat total reads +$0)
    const fmtM=v=>{ const a=Math.abs(v), sgn=v<0?'-$':'+$'; return a<0.5?'+$0':(a>=1000?sgn+(a/1000).toFixed(2)+'B':sgn+Math.round(a).toLocaleString()+'m'); };
    const cls=v=> v>0?'up':(v<0?'neg':'');
    // trailing-window net over the last k days we hold (capped by how much history we have)
    const win=k=>{ const a=Math.max(0,n-k); let sum=0; for(let i=a;i<n;i++) sum+=s[i].net; return {sum, from:s[a].date, to:s[n-1].date, days:n-a}; };
    const w7=win(7), w30=win(30);
    const box=$('etf_cards');
    if(box && S){
      const cards=[
        ['Total Net Inflow', S.all_time_total, 'Since the January 2024 launch'],
        ['Last 7 Days', w7.sum, fmtDate(w7.from)+' – '+fmtDate(w7.to)],
        ['Last 30 Days', w30.sum, w30.days<30 ? w30.days+' days so far (filling in)' : fmtDate(w30.from)+' – '+fmtDate(w30.to)],
        ['Daily Net Inflow', l.net, fmtDate(l.date)],
        ['Record Inflow Day', S.record_inflow, 'Biggest single day ever'],
        ['Average Daily Flow', S.avg_daily, 'Per trading day since launch'] ];
      box.innerHTML = cards.map(c=>'<div class="ch-stat"><div class="l">'+c[0]+'</div><div class="n '+cls(c[1])+'">'+fmtM(c[1])+'</div><div class="s">'+c[2]+'</div></div>').join('')
        + '<p class="ch-hint" style="grid-column:1/-1;margin:2px 0 0">Net flows via Farside Investors, updated '+fmtDate(l.date)+'. Farside exposes about three weeks publicly, so the 30-day and longer windows fill in as this page accumulates history.</p>';
    }
    // live total for whatever span the chart is currently showing (recomputes on zoom / reset via ch.$onView)
    const winEl=$('etf_window');
    ch.$onView = ()=>{ if(!winEl) return; const sc=ch.scales.x;
      let a=Math.max(0,Math.ceil(sc.min)), b=Math.min(n-1,Math.floor(sc.max)); if(b<a){a=0;b=n-1;}
      let sum=0; for(let i=a;i<=b;i++) sum+=s[i].net;
      winEl.innerHTML='Net over the range shown, <b>'+fmtDate(s[a].date)+' – '+fmtDate(s[b].date)+'</b> ('+(b-a+1)+' days): <b style="color:'+(sum>=0?'var(--accent-2)':'#e2574a')+'">'+fmtM(sum)+'</b>. Drag across the chart to total any span.'; };
    ch.$onView();
    setRead((S?'All-time net inflow into the US spot ETFs is <b>'+money(S.all_time_total/1000,2)+' billion</b> since the January 2024 launch. ':'')
      +'The latest day was <b>'+money(l.net,0)+'m</b> ('+fmtDate(l.date)+'). Green bars are inflow days, red are outflow days, and the orange line is the running total.', l.net>=0);
    return ch; };

  R.analogs = D => { const AA=D.charts.analogs, colors=['#f7931a','#2dd4bf','#e0b23a','#a06cd5','#e2574a'];
    let asset = AA.BTC ? 'BTC' : Object.keys(AA)[0];
    // one plugin: shade the forward zone, draw the TODAY divider, and label each forward path's return at its end
    const decor=k=>({ id:'ad', afterDatasetsDraw(ch){ const A=AA[k], W=A.window, a=ch.chartArea, x=ch.scales.x, y=ch.scales.y, g=ch.ctx; if(!a) return;
      const px=Math.max(a.left,Math.min(a.right,x.getPixelForValue(W)));
      g.save(); g.fillStyle='rgba(247,147,26,.05)'; g.fillRect(px,a.top,a.right-px,a.bottom-a.top);
      g.strokeStyle='rgba(232,237,246,.55)'; g.lineWidth=1; g.setLineDash([4,4]); g.beginPath(); g.moveTo(px,a.top); g.lineTo(px,a.bottom); g.stroke(); g.setLineDash([]);
      g.fillStyle=C.text; g.font='800 11px -apple-system,sans-serif'; g.textAlign='center'; g.fillText('TODAY',px,a.top+11);
      g.fillStyle=C.muted; g.font='600 10px -apple-system,sans-serif'; g.textAlign='left'; g.fillText('history ←',a.left+6,a.top+11); g.textAlign='right'; g.fillText('→ what came next',a.right-6,a.top+11);
      const ys=A.analogs.map((an,i)=>({i,fwd:an.fwd,ey:y.getPixelForValue(an.path[an.path.length-1][1])})).sort((p,q)=>p.ey-q.ey);
      let prev=-99; g.font='800 12px -apple-system,sans-serif'; g.textAlign='left';
      ys.forEach(o=>{ let ly=o.ey; if(ly-prev<15) ly=prev+15; prev=ly; g.fillStyle=colors[o.i]; g.fillText((o.fwd>=0?'+':'')+o.fwd+'%', a.right+6, ly+4); }); g.restore(); } });
    const build=k=>{ const A=AA[k], W=A.window;
      const ds=A.analogs.map((an,i)=>({ label:an.date, data:an.path.map(p=>({x:p[0],y:p[1]})), borderWidth:2, pointRadius:0, tension:.15,
        segment:{ borderColor:c=>c.p0.parsed.x>=W?colors[i]:'rgba(154,167,189,.18)', borderDash:c=>c.p0.parsed.x>=W?[6,4]:undefined } }));
      ds.push({ label:'Now', data:A.current.map(p=>({x:p[0],y:p[1]})), borderColor:'#2f6fb0', borderWidth:4, pointRadius:0, tension:.15, order:-1 }); return ds; };
    const ch=new Chart($('chart'), { type:'line', data:{ datasets:build(asset) },
      options: baseOpts({ layout:{padding:{right:52,top:6}}, plugins:{ legend:{display:false},
        tooltip:{ filter:it=>it.dataset.label==='Now'||it.parsed.x>=AA[asset].window, callbacks:{ title:it=>'Day '+it[0].parsed.x, label:it=>it.dataset.label==='Now'?'This cycle (now)':fmtDate(it.dataset.label)+' then '+((AA[asset].analogs.find(x=>x.date===it.dataset.label)||{}).fwd>=0?'+':'')+(AA[asset].analogs.find(x=>x.date===it.dataset.label)||{}).fwd+'%' } } },
        scales:{ x:{ type:'linear', grid:{color:C.line}, ticks:{color:C.muted,font:{size:12},callback:v=>v+'d'}, title:{display:true,text:'Days from the window start',color:C.muted,font:{size:12}} },
                 y:{ grid:{color:C.line}, ticks:{display:false}, title:{display:true,text:'shape only (size removed)',color:C.muted,font:{size:11}} } } }),
      plugins:[watermark, decor(asset)] });
    const setLeg=()=>{ const A=AA[asset], el=$('analog_legend'); if(el) el.innerHTML='The <b style="color:#2f6fb0">bold blue</b> line is now. The faint grey lines are the 5 closest past matches, and each colored line is what came next after that match:<br>'+A.analogs.map((a,i)=>'<span style="color:'+colors[i]+';font-weight:700">'+fmtDate(a.date)+'</span> then <b>'+(a.fwd>=0?'+':'')+a.fwd+'%</b>').join(' &nbsp;&middot;&nbsp; '); };
    const bb=$('analog_assets'); if(bb){ bb.innerHTML=Object.keys(AA).map(k=>'<button class="ch-btn'+(k===asset?' active':'')+'" data-a="'+k+'">'+k+'</button>').join('');
      bb.querySelectorAll('button').forEach(b=>b.onclick=()=>{ asset=b.dataset.a; ch.data.datasets=build(asset); ch.config.plugins[ch.config.plugins.length-1]=decor(asset); ch.update(); bb.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b)); setLeg(); }); }
    setLeg();
    setRead('The <b style="color:#2f6fb0">bold line</b> is the last year of Bitcoin. The faint grey lines are the 5 past stretches that traced the most similar shape, and to the right of TODAY the colored lines show what each one did next. Read the spread as a range of what has happened before, not a forecast.');
    return ch; };

  function drawPsychology(D){ const cv=$('chart'); if(!cv) return; const P=D.charts.psychology;
    const box=cv.parentElement, dpr=window.devicePixelRatio||1, W=box.clientWidth, H=box.clientHeight;
    cv.style.width=W+'px'; cv.style.height=H+'px'; cv.width=W*dpr; cv.height=H*dpr;
    const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    const rr=(x,y,w,h,r)=>{ g.beginPath(); if(g.roundRect){ g.roundRect(x,y,w,h,r); } else { g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); } };
    const halo=(t,x,y)=>{ g.strokeStyle='rgba(9,12,18,.92)'; g.lineWidth=3.6; g.lineJoin='round'; g.strokeText(t,x,y); g.fillText(t,x,y); };
    const usd=n=> n>=1000?'$'+Math.round(n/1000)+'k':'$'+Math.round(n);
    const pad={l:20,r:20,t:84,b:82};
    // [x, height, label, color, big?]
    const kf=[[0.02,0.28,'Disbelief','#5b9bd5',0],[0.11,0.36,'Hope','#4ea3c9',0],[0.20,0.46,'Optimism','#43b581',0],[0.30,0.57,'Belief','#5bbf5b',0],[0.39,0.74,'Thrill','#d4a017',0],[0.46,0.95,'Euphoria','#f7931a',1],[0.55,0.73,'Complacency','#f0a35e',0],[0.62,0.60,'Anxiety','#e07b3a',0],[0.69,0.49,'Denial','#e2574a',0],[0.76,0.35,'Panic','#c0392b',0],[0.83,0.20,'Capitulation','#8e44ad',1],[0.89,0.10,'Depression','#3b6fb0',0],[0.99,0.26,'','#43b581',0]];
    const X=t=>pad.l+t*(W-pad.l-pad.r), Y=h=>H-pad.b-h*(H-pad.t-pad.b);
    const pos=P.position, pp=P.price_path;
    // road-ahead zone (what typically comes next, right of you-are-here)
    g.fillStyle='rgba(154,167,189,.05)'; g.fillRect(X(pos), pad.t-32, Math.max(0,W-X(pos)-2), H-pad.b-(pad.t-32)+42);
    // the emotion "map": a faint dashed reference arc
    const emo=g.createLinearGradient(0,0,W,0); emo.addColorStop(0,'#5b9bd5'); emo.addColorStop(0.30,'#43b581'); emo.addColorStop(0.46,C.orange); emo.addColorStop(0.60,'#e2574a'); emo.addColorStop(0.83,'#8e44ad'); emo.addColorStop(1,'#3b6fb0');
    g.save(); g.globalAlpha=.5; g.setLineDash([2,6]); g.lineCap='round'; g.beginPath(); g.moveTo(X(kf[0][0]),Y(kf[0][1]));
    for(let i=1;i<kf.length;i++){ const a=kf[i-1],b=kf[i], cx=(X(a[0])+X(b[0]))/2; g.bezierCurveTo(cx,Y(a[1]),cx,Y(b[1]),X(b[0]),Y(b[1])); }
    g.lineWidth=2.5; g.strokeStyle=emo; g.stroke(); g.restore();
    // the real journey: BTC price this cycle (bottom -> today), mapped onto the same arc
    let px, py;
    if(pp && pp.length){
      const pg=g.createLinearGradient(0,0,W,0); pg.addColorStop(0,'#4ec97a'); pg.addColorStop(.5,C.orange); pg.addColorStop(1,'#e2574a');
      g.save(); g.shadowColor='rgba(247,147,26,.3)'; g.shadowBlur=12; g.beginPath();
      pp.forEach((p,i)=> i? g.lineTo(X(p[0]),Y(p[1])) : g.moveTo(X(p[0]),Y(p[1])));
      g.lineWidth=5; g.lineJoin='round'; g.lineCap='round'; g.strokeStyle=pg; g.stroke(); g.restore();
      px=X(pp[pp.length-1][0]); py=Y(pp[pp.length-1][1]);
      let pk=0; for(let i=1;i<pp.length;i++) if(pp[i][1]>pp[pk][1]) pk=i;   // cycle-top anchor
      g.font='800 11px -apple-system,sans-serif'; g.textAlign='left'; g.fillStyle='#4ec97a'; halo('Cycle low '+usd(P.price_low), X(pp[0][0])+8, Y(pp[0][1])+2);
      g.textAlign='center'; g.fillStyle=C.orange; halo('Top '+usd(P.price_high), X(pp[pk][0]), Y(pp[pk][1])-13);
    } else { const hAt=t=>{ let a=kf[0],b=kf[kf.length-1]; for(let i=1;i<kf.length;i++){ if(kf[i][0]>=t){a=kf[i-1];b=kf[i];break;} } return a[1]+(b[1]-a[1])*((t-a[0])/(b[0]-a[0]+1e-9)); }; px=X(pos); py=Y(hAt(pos)); }
    // eyebrow + legend
    g.textAlign='left'; g.textBaseline='alphabetic'; g.fillStyle=C.muted; g.font='800 12px -apple-system,sans-serif'; g.fillText('THE MARKET EMOTION CYCLE', pad.l, 26);
    g.strokeStyle=C.orange; g.lineWidth=3.5; g.beginPath(); g.moveTo(pad.l,44); g.lineTo(pad.l+24,44); g.stroke();
    g.fillStyle=C.text; g.font='700 11.5px -apple-system,sans-serif'; g.fillText('BTC price this cycle', pad.l+30, 48);
    const lx=pad.l+30+g.measureText('BTC price this cycle').width+18;
    g.save(); g.setLineDash([2,4]); g.globalAlpha=.7; g.strokeStyle='#9aa7bd'; g.lineWidth=2.5; g.beginPath(); g.moveTo(lx,44); g.lineTo(lx+24,44); g.stroke(); g.restore();
    g.fillStyle=C.muted; g.fillText('typical emotion path', lx+30, 48);
    // phase labels, moved off the line with a dark halo (skip the current phase + the marker column)
    const cur=(P.phase||'').toLowerCase();
    kf.forEach(k=>{ if(!k[2] || k[2].toLowerCase()===cur || Math.abs(X(k[0])-px)<36) return; const big=k[4]; g.textAlign='center'; g.fillStyle=k[3];
      g.font=(big?'800 ':'700 ')+(big?15.5:11.5)+'px -apple-system,sans-serif';
      const yy = k[1]>=0.5 ? Y(k[1])-(big?26:20) : Y(k[1])+(big?32:25);
      halo(big?k[2].toUpperCase():k[2], X(k[0]), yy); });
    g.fillStyle=C.muted; g.font='700 11px -apple-system,sans-serif'; g.textAlign='left'; g.globalAlpha=.85; halo('the road ahead', X(pos)+9, pad.t-16); g.globalAlpha=1;
    // ---- YOU ARE HERE (on the real price line) ----
    g.strokeStyle='rgba(232,237,246,.15)'; g.lineWidth=1; g.setLineDash([3,5]); g.beginPath(); g.moveTo(px,pad.t-30); g.lineTo(px,H-pad.b+40); g.stroke(); g.setLineDash([]);
    g.save(); for(let i=0;i<3;i++){ g.beginPath(); g.arc(px,py,24-i*6,0,7); g.fillStyle='rgba(226,87,74,'+(0.05+i*0.055)+')'; g.fill(); }
    g.beginPath(); g.arc(px,py,10,0,7); g.fillStyle='#fff'; g.fill(); g.lineWidth=4.5; g.strokeStyle=C.red; g.stroke(); g.restore();
    // phase pill: to the lower-right in the road-ahead if there is room, else dropped below
    const label=(P.phase||'').toUpperCase(); g.font='900 24px -apple-system,sans-serif'; const tw=g.measureText(label).width;
    const pillW=tw+32, pillH=44, room=W-px;
    let pillX, pillY;
    if(room > pillW+40){ pillX=Math.min(W-pillW-8, px+22); pillY=Math.min(H-pillH-40, py+16); }
    else { pillX=Math.max(8, Math.min(W-pillW-8, px-pillW/2)); pillY=Math.max(py+40, H*0.72); }
    g.strokeStyle=C.red; g.lineWidth=2.5; g.beginPath(); g.moveTo(px,py); g.lineTo(pillX+(px<pillX?12:pillW-12), pillY); g.stroke();
    g.save(); g.shadowColor='rgba(226,87,74,.45)'; g.shadowBlur=16; g.fillStyle=C.red; rr(pillX,pillY,pillW,pillH,11); g.fill(); g.restore();
    g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.font='900 24px -apple-system,sans-serif'; g.fillText(label,pillX+pillW/2,pillY+pillH/2+1);
    g.textBaseline='alphabetic'; g.fillStyle=C.text; g.font='800 11px -apple-system,sans-serif'; halo('◉ YOU ARE HERE'+(P.price_now?' · '+usd(P.price_now):''), pillX+pillW/2, pillY-9);
    // watermark
    g.save(); g.globalAlpha=.6; g.fillStyle=C.muted; g.font='600 12px -apple-system,sans-serif'; g.textAlign='right'; g.textBaseline='bottom'; g.fillText('bitcoin-daily.com',W-8,H-6); g.restore(); }
  R.psychology = D => { drawPsychology(D); new ResizeObserver(()=>drawPsychology(D)).observe($('chart').parentElement);
    const P=D.charts.psychology; setRead('The <b style="color:#f7931a">bold line</b> is Bitcoin\'s real price this cycle, from the '+(P.price_low?'$'+Math.round(P.price_low/1000)+'k ':'')+'low up to today, traced over the crowd\'s emotional arc (the dashed guide). Bitcoin is about <b>'+P.since_top_days+' days</b> past its cycle top and <b>'+P.drawdown+'%</b> below it, which lands us around <b style="color:#e2574a">'+P.phase+'</b>'+(P.fng!=null?', with Fear and Greed at '+P.fng+' ('+P.fng_class+')':'')+'. The crowd is usually most wrong at the extremes.', true); return null; };

  R.halving = D => { const hv=D.charts.halving_eta; const cap=$('halving_cap');
    const dateEl=$('halving_date'); if(dateEl) dateEl.innerHTML='Estimated <b>'+fmtDate(hv.eta_date)+'</b>';
    if(cap && hv.height) cap.textContent='Block '+hv.height.toLocaleString()+' of '+hv.next_block.toLocaleString()+'. Estimated at roughly one block every ten minutes.';
    const bar=$('halving_bar'); if(bar) bar.style.width=(hv.progress_pct||0)+'%';
    const note=$('halving_note'); if(note) note.innerHTML='The block reward falls from '+hv.reward_now+' to '+hv.reward_after+' BTC. The last halving was '+fmtDate(hv.last_halving)+'.'+(hv.progress_pct?' This epoch is '+hv.progress_pct+'% complete.':'');
    const target=new Date(hv.eta_date+'T00:00:00').getTime();
    function tick(){ const cnt=$('halving_count'); if(!cnt) return; let s=Math.max(0,Math.floor((target-Date.now())/1000));
      const d=Math.floor(s/86400); s-=d*86400; const h=Math.floor(s/3600); s-=h*3600; const m=Math.floor(s/60); s-=m*60;
      cnt.innerHTML=[[d,'days'],[h,'hours'],[m,'minutes'],[s,'seconds']].map(x=>'<div><div class="cn">'+x[0]+'</div><div class="cl">'+x[1]+'</div></div>').join(''); }
    tick(); setInterval(tick,1000); return null; };

  function render(key, D){ BDCharts.chart2=null; const ch = R[key] ? R[key](D) : null; BDCharts.chart = ch;
    // drag-across-to-zoom on x; on split charts (a second panel) zooming one syncs the other (chartjs-plugin-zoom auto-registers on load)
    const charts=[ch, BDCharts.chart2].filter(c=>c && c.options && c.options.plugins);
    let syncing=false;
    charts.forEach(c=>{ c.options.plugins.zoom = { zoom:{ drag:{ enabled:true, backgroundColor:'rgba(247,147,26,.15)', borderColor:C.orange, borderWidth:1 },
        wheel:{enabled:false}, pinch:{enabled:true}, mode:'x',
        onZoomComplete:({chart})=>{ if(!syncing && charts.length>=2){ syncing=true; const r=chart.scales.x;
          charts.forEach(o=>{ if(o!==chart) o.zoomScale('x',{min:r.min,max:r.max},'none'); }); syncing=false; } if(chart.$onView) chart.$onView(); } }, pan:{enabled:false} };
      c.update('none'); });
    const rz=$('resetzoom'); if(rz){ if(charts.length){ rz.onclick=()=>{ syncing=true; charts.forEach(c=>c.resetZoom&&c.resetZoom()); syncing=false; charts.forEach(c=>c.$onView&&c.$onView()); }; } else { rz.style.display='none'; } }
    const lg=$('logtoggle'); if(lg && ch && ch.options.scales.y && ch.options.scales.y.type==='logarithmic'){
      lg.onclick=()=>{ const log=ch.options.scales.y.type==='logarithmic'; ch.options.scales.y.type=log?'linear':'logarithmic';
        ch.options.scales.y.ticks.callback = log ? (v=>v>=1000?'$'+(v/1000)+'k':'$'+v) : logTick; lg.textContent=log?'Linear scale':'Log scale'; lg.classList.toggle('active',!log); ch.update(); }; }
    const sv=$('save'); if(sv) sv.onclick=()=>saveImg(document.title.split('|')[0].trim());
    return ch; }

  // short "current reading" string for the index cards
  function summary(key, D){ const c=D.charts[key]; if(!c) return '';
    switch(key){
      case 'realized_price': return (c.latest.over_under_pct>=0?'+':'')+c.latest.over_under_pct+'% vs holder cost';
      case 'mvrv': return 'MVRV '+c.latest.toFixed(2);
      case 'mayer': return 'Mayer '+c.latest.toFixed(2);
      case 'puell': return 'Puell '+c.latest.toFixed(2);
      case 'nupl': return c.latest.toFixed(2)+' - '+c.current_zone;
      case 'pi_cycle': return Math.abs(c.gap_pct)+'% below the top trigger';
      case 'ma200w': return c.latest.mult.toFixed(2)+'x the 200-week floor';
      case 'power_law': return (c.latest.vs_fair_pct>=0?'+':'')+c.latest.vs_fair_pct+'% vs fair value';
      case 'bottom_zone': return c.latest.in_zone ? 'in the zone, '+c.latest.days_to_window+'d to window' : 'proj bottom $'+Math.round(c.proj.bottom/1000)+'k';
      case 'rainbow': return '"'+c.current_band+'" band';
      case 'ahr999': return 'AHR999 '+c.latest.toFixed(2);
      case 'mvrv_z': return 'Z-Score '+c.latest.toFixed(2);
      case 'volatility': return Math.round(c.latest.vol30)+'% vol (30d)';
      case 'hashrate': return Math.round(c.latest.hashrate).toLocaleString()+' EH/s';
      case 'hash_ribbons': return c.latest.capitulating ? 'miners capitulating' : 'miners healthy';
      case 'active_addresses': return Math.round(c.latest/1000)+'k active/day';
      case 'supply': return c.latest.pct_mined+'% mined, '+c.latest.inflation.toFixed(2)+'% infl';
      case 'ma2y': return c.latest.mult.toFixed(2)+'x the 2-year MA';
      case 'compass': return c.latest.phase+', '+Math.round(c.latest.score)+'/100';
      case 'drawdown': return c.now.dd+'% below the top';
      case 'cycle_band': return c.now.mult.toFixed(2)+'x, '+c.now.pos;
      case 'metcalfe': return Math.round(c.latest)+'% of network trend';
      case 'sentiment': return 'price '+(c.latest.pc>=0?'+':'')+c.latest.pc+'% over 30d';
      case 'monthly_returns': { const mo=new Date().getMonth(), nm=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo], a=c.avg[mo+1]; return a==null?'monthly seasonality':nm+' avg '+(a>=0?'+':'')+a.toFixed(1)+'%'; }
      case 'analogs': { const A=c.BTC||Object.values(c)[0]; const t=A.analogs[0]; return 'closest: '+t.date.slice(0,4)+', next '+(t.fwd>=0?'+':'')+t.fwd+'%'; }
      case 'psychology': return c.phase+' phase';
      case 'halving_corr': return 'closest to '+c.closest+' (r '+c.closest_r.toFixed(2)+')';
      case 'fng': return c.latest+' - '+c.classification;
      case 'miner_cost': return fmtUSD(c.latest.cost)+' to mine one';
      case 'etf_flows': return c.summary ? 'all-time +$'+(c.summary.all_time_total/1000).toFixed(1)+'B' : 'latest '+(c.latest.net>=0?'+':'')+'$'+c.latest.net+'m';
      case 'mstr': return Math.round(c.holdings/1000)+'k BTC, '+(c.pnl_pct>=0?'+':'')+c.pnl_pct+'%';
      case 'altseason': return c.index+'/100, '+c.classification;
      case 'm2_vs_btc': return '$'+c.m2_latest_t+'T M2, corr '+c.corr_yoy;
      case 'pmi_vs_btc': return 'corr '+c.corr_mom+', near zero';
      case 'sp500_vs_btc': return 'avg corr '+c.full_avg+', not 0.87';
      case 'halving_eta': return c.days_remaining+' days to go';
      default: return ''; } }

  global.BDCharts = { C, fmtUSD, fmtDate, render, summary, saveImg, chart:null, chart2:null };
})(window);
