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

  const baseOpts = extra => Object.assign({
    responsive:true, maintainAspectRatio:false, animation:false, interaction:{ mode:'index', intersect:false },
    plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'#0b0e14', borderColor:'rgba(255,255,255,.12)', borderWidth:1, padding:10 } },
    scales:{ x:{ grid:{display:false}, ticks:{ color:C.muted, font:{size:12}, maxTicksLimit:9, autoSkip:true, callback:function(i){ const l=this.getLabelForValue(i); return l?String(l).slice(0,4):''; } } },
             y:{ grid:{color:C.line}, ticks:{ color:C.muted, font:{size:12} } } } }, extra||{});

  function saveImg(title){ const src=$('chart'); if(!src) return; const dpr=window.devicePixelRatio||1;
    const hH=Math.round(58*dpr), fH=Math.round(36*dpr), o=document.createElement('canvas'); o.width=src.width; o.height=src.height+hH+fH;
    const g=o.getContext('2d'); g.fillStyle='#0b0e14'; g.fillRect(0,0,o.width,o.height); g.textBaseline='middle'; g.textAlign='left';
    g.fillStyle='#f7931a'; g.font='800 '+Math.round(20*dpr)+'px -apple-system,sans-serif'; g.fillText('Bitcoin Daily',Math.round(20*dpr),hH/2);
    g.textAlign='right'; g.fillStyle='#aeb6c4'; g.font='600 '+Math.round(14*dpr)+'px -apple-system,sans-serif'; g.fillText(title||'',o.width-Math.round(20*dpr),hH/2);
    g.drawImage(src,0,hH); const fy=src.height+hH+fH/2; g.textAlign='left'; g.fillStyle='#6b7280'; g.font='600 '+Math.round(12*dpr)+'px -apple-system,sans-serif';
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
  function drawFngGauge(v){ const cv=$('fng-gauge'); if(!cv) return; const W=300,H=168,dpr=window.devicePixelRatio||1;
    cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px';
    const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    const cx=W/2, cy=H-16, R=116, lw=20;
    [['#e2574a',0,20],['#f0883e',20,40],['#d9b44a',40,60],['#8cc84b',60,80],['#2ea043',80,100]].forEach(s=>{
      g.beginPath(); g.lineWidth=lw; g.strokeStyle=s[0]; g.arc(cx,cy,R,Math.PI+(s[1]/100)*Math.PI+ (s[1]?0.012:0), Math.PI+(s[2]/100)*Math.PI-0.012); g.stroke(); });
    const ang=Math.PI+(Math.max(0,Math.min(100,v))/100)*Math.PI;
    g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(ang)*(R+3), cy+Math.sin(ang)*(R+3)); g.strokeStyle='#e8edf6'; g.lineWidth=3; g.lineCap='round'; g.stroke();
    g.beginPath(); g.arc(cx,cy,6,0,7); g.fillStyle='#e8edf6'; g.fill(); }

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

  R.m2_vs_btc = D => { const s=D.charts.m2_vs_btc.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'M2', data:s.map(d=>d.m2), borderColor:C.teal, borderWidth:2, pointRadius:0, tension:.25, yAxisID:'y2' },
        { label:'BTC', data:s.map(d=>d.btc), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.25, yAxisID:'y' } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>it.datasetIndex===1?'BTC '+fmtUSD(it.parsed.y):'M2 $'+(it.parsed.y/1000).toFixed(1)+'T' } } },
        scales:{ x:baseOpts().scales.x, y:logY(), y2:{ position:'right', grid:{display:false}, ticks:{color:C.teal,font:{size:12},callback:v=>'$'+(v/1000).toFixed(0)+'T'} } } }), plugins:[watermark, agreeShade(s), cycleMarks(D)] });
    setRead('US M2 is about <b>$'+D.charts.m2_vs_btc.m2_latest_t+' trillion</b>. Green shading marks months they moved the same direction, red marks opposite. Year-over-year correlation is '+D.charts.m2_vs_btc.corr_yoy+', a real but loose link.'); return ch; };

  R.pmi_vs_btc = D => { const s=D.charts.pmi_vs_btc.series, labels=s.map(d=>d.date);
    const ch=new Chart($('chart'), { type:'line',
      data:{ labels, datasets:[
        { label:'PMI', data:s.map(d=>d.pmi), borderColor:C.blue, borderWidth:2, pointRadius:0, tension:.25, yAxisID:'y2' },
        { label:'BTC', data:s.map(d=>d.btc), borderColor:C.orange, borderWidth:2, pointRadius:0, tension:.25, yAxisID:'y' } ]},
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>fmtDate(labels[it[0].dataIndex]),
        label:it=>it.datasetIndex===1?'BTC '+fmtUSD(it.parsed.y):'PMI '+it.parsed.y.toFixed(1) } } },
        scales:{ x:baseOpts().scales.x, y:logY(), y2:{ position:'right', grid:{display:false}, min:33, max:66, ticks:{color:C.blue,font:{size:12}} } } }),
      plugins:[watermark, { id:'pmi50', beforeDatasetsDraw(ch){ const ar=ch.chartArea, y2=ch.scales.y2, g=ch.ctx; if(!ar) return; const py=y2.getPixelForValue(50);
        g.save(); g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1; g.setLineDash([4,4]); g.beginPath(); g.moveTo(ar.left,py); g.lineTo(ar.right,py); g.stroke();
        g.setLineDash([]); g.fillStyle=C.muted; g.font='600 10px -apple-system,sans-serif'; g.textAlign='right'; g.fillText('PMI 50 = flat',ar.right-6,py-3); g.restore(); } }, agreeShade(s), cycleMarks(D)] });
    setRead('Green shading marks months Bitcoin and PMI moved the same direction, red marks opposite. Notice how often it flips. The correlation of monthly moves is <b>'+D.charts.pmi_vs_btc.corr_mom+'</b>, effectively zero.'); return ch; };

  R.sp500_vs_btc = D => { const y=D.charts.sp500_vs_btc.years, labels=y.map(d=>String(d.year)), vals=y.map(d=>d.corr);
    const ch=new Chart($('chart'), { type:'bar', data:{ labels, datasets:[{ data:vals, backgroundColor:y.map(d=>d.year<2020?C.teal:C.orange), borderRadius:3 }] },
      options: baseOpts({ plugins:{ legend:{display:false}, tooltip:{ callbacks:{ title:it=>it[0].label, label:it=>'Correlation '+it.parsed.y.toFixed(2) } } },
        scales:{ x:{ grid:{display:false}, ticks:{color:C.muted,font:{size:12}} }, y:{ grid:{color:C.line}, ticks:{color:C.muted,font:{size:12}}, suggestedMin:-0.25, suggestedMax:1 } } }),
      plugins:[watermark, thresholds([{v:D.charts.sp500_vs_btc.claim,c:C.red,t:'the "0.87" claim'},{v:D.charts.sp500_vs_btc.full_avg,c:C.muted,t:'full-period average '+D.charts.sp500_vs_btc.full_avg}])] });
    setRead('The full-period average correlation is <b>'+D.charts.sp500_vs_btc.full_avg+'</b>, not the 0.87 people quote. It even goes negative in some years.'); return ch; };

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

  function render(key, D){ const ch = R[key] ? R[key](D) : null; BDCharts.chart = ch;
    // drag-across-to-zoom on the x-axis (chartjs-plugin-zoom auto-registers when its script loads)
    if(ch && ch.options && ch.options.plugins){
      ch.options.plugins.zoom = { zoom:{ drag:{ enabled:true, backgroundColor:'rgba(247,147,26,.15)', borderColor:C.orange, borderWidth:1 },
        wheel:{enabled:false}, pinch:{enabled:true}, mode:'x' }, pan:{enabled:false} };
      ch.update('none'); }
    const rz=$('resetzoom'); if(rz){ if(ch && ch.resetZoom){ rz.onclick=()=>ch.resetZoom(); } else { rz.style.display='none'; } }
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
      case 'rainbow': return '"'+c.current_band+'" band';
      case 'ahr999': return 'AHR999 '+c.latest.toFixed(2);
      case 'ma2y': return c.latest.mult.toFixed(2)+'x the 2-year MA';
      case 'drawdown': return c.now.dd+'% below the top';
      case 'fng': return c.latest+' - '+c.classification;
      case 'miner_cost': return fmtUSD(c.latest.cost)+' to mine one';
      case 'm2_vs_btc': return '$'+c.m2_latest_t+'T M2, corr '+c.corr_yoy;
      case 'pmi_vs_btc': return 'corr '+c.corr_mom+', near zero';
      case 'sp500_vs_btc': return 'avg corr '+c.full_avg+', not 0.87';
      case 'halving_eta': return c.days_remaining+' days to go';
      default: return ''; } }

  global.BDCharts = { C, fmtUSD, fmtDate, render, summary, saveImg, chart:null };
})(window);
