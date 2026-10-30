"use strict";
(() => {
  const $ = id => document.getElementById(id);
  // Older HTML may remain cached during deployment. Resolve both versions
  // inside the summary so the mean input can never shadow its readout.
  const summary=document.querySelector(".distribution-stats");
  const priorMeanValue=summary.querySelector("#prior-mean-value, #prior-mean");
  const dataEstimateValue=summary.querySelector("#data-estimate-value, #data-estimate");
  const posteriorMeanValue=summary.querySelector("#posterior-mean-value, #posterior-mean");
  const config = {
    beta: {pair:"Beta prior · Binomial likelihood",priorFamily:"Beta(α, β)",dataFamily:"Binomial(n, θ)",
      prior:{a:1,b:1},data:{k:8,n:12},
      priorFields:[["a","Alpha α",.1,60,.1],["b","Beta β",.1,60,.1]],
      dataFields:[["k","Heads k",0,12,1],["n","Tosses n",1,200,1]],axis:"Chance of heads θ"},
    gamma: {pair:"Gamma prior · Poisson likelihood",priorFamily:"Gamma(shape, scale)",dataFamily:"Poisson(λ × T)",
      prior:{a:2,scale:2},data:{k:6,t:2},
      priorFields:[["a","Shape α",.1,30,.1],["scale","Scale s",.05,5,.05]],
      dataFields:[["k","Arrivals k",0,50,1],["t","Hours T",.1,20,.1]],axis:"Arrival rate λ (per hour)"},
    normal: {pair:"Normal prior · Normal likelihood",priorFamily:"Normal(μ, σ)",dataFamily:"Normal(θ, σₑ)",
      prior:{mean:0,sd:3},data:{y:2,se:.5},
      priorFields:[["mean","Mean μ",-10,10,.1],["sd","Width σ",.1,10,.1]],
      dataFields:[["y","Observed y",-5,5,.1],["se","Error σₑ",.05,3,.05]],axis:"True value θ"}
  };
  let family="beta", prior={...config.beta.prior}, data={...config.beta.data}, pinned=null, logScale=false;
  let current, reference, activePreset="broad", drawQueued=false;
  const fmt = v => {
    if(!Number.isFinite(v)) return v===Infinity ? "∞" : "0";
    if(v===0) return "0";
    if(Math.abs(v)>=1e4 || Math.abs(v)<.001) return v.toExponential(2).replace("e+","e");
    return Number(v.toPrecision(4)).toLocaleString("en",{maximumFractionDigits:5});
  };
  const logFmt = value => {
    if(value===Infinity)return "∞";
    if(value===-Infinity)return "0";
    if(value < -690) {
      const exponent=Math.floor(value/Math.LN10);
      return `${Math.exp(value-exponent*Math.LN10).toFixed(2)}e${exponent}`;
    }
    return fmt(Math.exp(value));
  };
  function powerHTML(logValue) {
    if(logValue>-9 && logValue<9) return fmt(Math.exp(logValue));
    const exponent=Math.floor(logValue/Math.LN10), mantissa=Math.exp(logValue-exponent*Math.LN10);
    return `${mantissa.toFixed(2)} × 10<sup>${exponent}</sup>`;
  }
  function fields(target, definitions, values, group) {
    $(target).innerHTML=definitions.map(([key,label,min,max,step])=>`<div class="control"><div class="control-top"><label for="${group}-${key}">${label}</label><input type="number" id="${group}-${key}" min="${min}" max="${max}" step="${step}" value="${values[key]}" aria-label="${group} ${label}"></div><input type="range" id="${group}-${key}-range" min="${min}" max="${max}" step="${step}" value="${values[key]}" aria-label="${group} ${label} slider"></div>`).join("");
    definitions.forEach(([key,,, ,step])=>{
      const number=$(`${group}-${key}`), range=$(`${group}-${key}-range`);
      const apply=(source,final=false)=>{
        if(source.value==="" || !Number.isFinite(source.valueAsNumber)) {
          if(final) source.value=values[key];
          return;
        }
        let value=source.valueAsNumber;
        const min=Number(source.min),max=Number(source.max);
        if(!final && source===number && (value<min||value>max|| (step===1&&!Number.isInteger(value)))) return;
        value=Math.max(min,Math.min(max,value));
        value=Number((min+Math.round((value-min)/step)*step).toFixed(8));
        values[key]=value;
        if(source!==number||final) number.value=value;
        range.value=value;
        if(group==="prior") activePreset=null;
        if(family==="beta"&&group==="data"&&key==="n") {
          data.k=Math.min(data.k,data.n);
          $("data-k").max=data.n; $("data-k-range").max=data.n;
          $("data-k").value=data.k; $("data-k-range").value=data.k;
        }
        update();
      };
      number.addEventListener("input",()=>apply(number));
      number.addEventListener("change",()=>apply(number,true));
      number.addEventListener("blur",()=>apply(number,true));
      range.addEventListener("input",()=>apply(range));
    });
  }
  function renderControls() {
    const c=config[family];
    $("model-pair").textContent=c.pair; $("prior-family").textContent=c.priorFamily; $("data-family").textContent=c.dataFamily;
    fields("prior-controls",c.priorFields,prior,"prior");
    const dataFields=c.dataFields.map(field=>[...field]);
    if(family==="beta") dataFields[0][3]=data.n;
    fields("data-controls",dataFields,data,"data");
    document.querySelector('[data-preset="broad"]').textContent=family==="beta"?"Flat":"Broad";
  }
  function reset() {
    prior={...config[family].prior}; data={...config[family].data}; pinned=null; activePreset=family==="gamma"?null:"broad";
    renderControls(); update();
  }
  function preset(kind) {
    if(family==="beta") {
      const mean=Math.max(.05,Math.min(.95,data.k/data.n));
      const strength=kind==="confident"?60:12;
      const m=kind==="sceptical"?Math.max(.05,Math.min(.95,mean>.5?.15:.85)):mean;
      prior=kind==="broad"?{a:1,b:1}:{a:Number((m*strength).toFixed(1)),b:Number(((1-m)*strength).toFixed(1))};
    } else if(family==="gamma") {
      const mean=Math.max(.2,data.k/data.t), strength=kind==="confident"?25:4;
      const m=kind==="sceptical"?Math.max(.2,mean*.2):mean;
      prior=kind==="broad"?{a:1,scale:5}:{a:strength,scale:Math.max(.05,Math.min(5,Number((Math.round(m/strength/.05)*.05).toFixed(2))))};
    } else {
      prior=kind==="broad"?{mean:0,sd:3}:{mean:kind==="sceptical"?Math.max(-10,Math.min(10,data.y+(data.y>=0?-1:1)*Math.max(3,4*data.se))):data.y,sd:kind==="confident"?.2:1};
    }
    activePreset=kind; renderControls(); update();
  }
  function update() {
    current=Bayes.model(family,prior,data); reference=pinned?Bayes.model(family,pinned,data):null;
    priorMeanValue.textContent=fmt(current.priorMean); priorMeanValue.title=current.priorDescription;
    posteriorMeanValue.textContent=fmt(current.posteriorMean); posteriorMeanValue.title=current.posteriorDescription;
    dataEstimateValue.textContent=fmt(current.estimate);
    document.querySelectorAll("[data-preset]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.preset===activePreset)));
    const experiment=$("experiment");
    if(family==="beta") {
      const shown=Math.min(data.n,36);
      // Distribute the displayed heads across the row; the count likelihood is unordered.
      experiment.innerHTML=Array.from({length:shown},(_,i)=>{
        const head=Math.floor((i+1)*data.k/data.n)>Math.floor(i*data.k/data.n);
        return `<span class="coin${head?"":" tail"}">${head?"H":"T"}</span>`;
      }).join("")+(data.n>shown?`<span class="more-coins">+${data.n-shown}</span>`:"");
      $("data-summary").textContent=`${data.k} heads in ${data.n} toss${data.n===1?"":"es"}`;
      $("evidence-caption").textContent=`P(${data.k} heads in ${data.n} toss${data.n===1?"":"es"})`;
    } else if(family==="gamma") {
      experiment.innerHTML=Array.from({length:Math.min(data.k,36)},()=>'<span class="arrival"></span>').join("")+(data.k>36?`<span class="more-coins">+${data.k-36}</span>`:"");
      $("data-summary").textContent=`${data.k} arrivals in ${fmt(data.t)} hour${data.t===1?"":"s"}`;
      $("evidence-caption").textContent=`P(${data.k} arrivals in ${fmt(data.t)} hour${data.t===1?"":"s"})`;
    } else {
      experiment.innerHTML="";
      $("data-summary").textContent=`Measurement ${fmt(data.y)} ± ${fmt(data.se)}`;
      $("evidence-caption").textContent=`Predictive density at y = ${fmt(data.y)} (per unit y)`;
    }
    if(family!=="normal"&&current.logZ>Math.log(.0001)) $("evidence").textContent=`${(100*Math.exp(current.logZ)).toLocaleString("en",{maximumFractionDigits:3})}%`;
    else $("evidence").innerHTML=powerHTML(current.logZ);
    $("log-evidence").textContent=`ln Z = ${current.logZ.toFixed(4)}${family!=="normal"?` · Z = ${logFmt(current.logZ)}`:""}`;
    $("pinned-key").hidden=!pinned;
    $("pin").innerHTML=pinned?'Replace pinned prior <span aria-hidden="true">↻</span>':'Pin this prior <span aria-hidden="true">＋</span>';
    if(reference) {
      const logRatio=current.logZ-reference.logZ;
      $("comparison").innerHTML=`<div class="comparison-ratio">${powerHTML(logRatio)}×</div><p class="comparison-caption">evidence vs pinned prior</p><p class="pinned-summary">${reference.priorDescription} · <button type="button" id="unpin" class="unpin">clear</button></p>`;
      $("unpin").addEventListener("click",()=>{pinned=null;update();});
    } else $("comparison").innerHTML='<p class="comparison-hint">Pin a prior, then change it.</p>';
    queueDraw();
  }
  function queueDraw() {
    if(drawQueued) return;
    drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;draw();});
  }
  function draw() {
    const container=$("plot"), width=container.clientWidth, height=container.clientHeight;
    if(width<1) return;
    const actual=$("likelihood-scale").value==="actual", margin={left:48,right:actual?57:18,top:24,bottom:48};
    const W=width-margin.left-margin.right,H=height-margin.top-margin.bottom;
    const [lo,hi]=reference?[Math.min(current.bounds[0],reference.bounds[0]),Math.max(current.bounds[1],reference.bounds[1])]:current.bounds;
    const span=hi-lo, xPos=x=>margin.left+(x-lo)/span*W;
    const points=[lo,hi];
    for(let i=1;i<1600;i++) {
      points.push(lo+span*i/1600,lo+span*(1-Math.cos(Math.PI*i/1600))/2);
    }
    // Resolve narrow peaks even when a very broad prior expands the horizontal axis.
    if(family==="normal") {
      const postSD=1/Math.hypot(1/prior.sd,1/data.se);
      const anchors=[[prior.mean,prior.sd],[data.y,data.se],[current.posteriorMean,postSD]];
      if(pinned) anchors.push([pinned.mean,pinned.sd]);
      anchors.forEach(([m,s])=>{for(let i=-120;i<=120;i++) {const x=m+i*s/20;if(x>lo&&x<hi) points.push(x);}});
    }
    points.sort((a,b)=>a-b);
    const xs=[...new Set(points)], likelihood=actual?current.likelihoodLog:current.likelihoodDensityLog;
    const curves=[{fn:current.priorLog,color:"#8261b8",fill:"#8261b8",opacity:.055,singular:current.singular,width:2.2},
      {fn:likelihood,color:"#c27a24",dash:"6 5",width:2.2,axis:actual},
      {fn:current.posteriorLog,color:"#168775",fill:"#168775",opacity:.1,width:2.8,singular:current.posteriorSingular}];
    if(reference) curves.unshift({fn:reference.priorLog,color:"#8995a5",dash:"3 5",width:1.7,singular:reference.singular});
    let leftPeak=-Infinity,rightPeak=-Infinity;
    curves.forEach(c=>{
      c.logs=xs.map(c.fn);
      c.logs.forEach((v,i)=>{
        if(!Number.isFinite(v))return;
        // Singular endpoint peaks are clipped, rather than flattening every other curve.
        if(c.singular && ((xs[i]-lo)<span*.005||(hi-xs[i])<span*.005)) return;
        if(c.axis)rightPeak=Math.max(rightPeak,v);else leftPeak=Math.max(leftPeak,v);
      });
    });
    function axis(peak) {
      if(logScale) {
        const top=Math.ceil(peak/Math.LN10),bottom=top-6;
        return {position:v=>margin.top+(top-Math.max(bottom,Math.min(top,v/Math.LN10)))/6*H,
          ticks:Array.from({length:7},(_,i)=>({value:(top-i)*Math.LN10,label:`10${superscript(top-i)}`}))};
      }
      const max=Math.exp(peak)*1.12;
      const raw=max/4,base=10**Math.floor(Math.log10(raw));
      const step=([1,2,2.5,5,10].find(n=>n*base>=raw)||10)*base;
      const top=Math.ceil(max/step)*step;
      return {position:v=>margin.top+H*(1-Math.min(top,Math.exp(v))/top),
        ticks:Array.from({length:Math.round(top/step)+1},(_,i)=>({value:i===0?-Infinity:Math.log(i*step),label:fmt(i*step)}))};
    }
    const left=axis(leftPeak),right=actual?axis(rightPeak):left;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="plot-title plot-desc"><title id="plot-title">Prior, likelihood, and posterior</title><desc id="plot-desc">${config[family].pair}. ${actual?"Prior and posterior use the left axis; actual likelihood uses the right axis.":"All curves are normalized to unit area for shape comparison."} ${logScale?"Logarithmic scale, showing six decades.":"Linear scale."} ${current.singular?"Infinite endpoint peaks are clipped.":""}</desc><defs><clipPath id="plot-clip"><rect x="${margin.left}" y="${margin.top}" width="${W}" height="${H}"/></clipPath></defs>`;
    svg+=`<text x="${margin.left}" y="12" class="axis-title">Density${logScale?" · log":""}</text>`;
    if(actual)svg+=`<text x="${width-margin.right}" y="12" text-anchor="end" class="axis-title" style="fill:#c27a24">Likelihood${logScale?" · log":""}</text>`;
    left.ticks.forEach(t=>{
      const y=left.position(t.value);
      svg+=`<line x1="${margin.left}" y1="${y}" x2="${width-margin.right}" y2="${y}" stroke="#e8edf1" stroke-dasharray="3 5"/><text x="${margin.left-10}" y="${y+4}" text-anchor="end">${t.label}</text>`;
    });
    if(actual)right.ticks.forEach(t=>{svg+=`<text x="${width-margin.right+10}" y="${right.position(t.value)+4}" style="fill:#a76b23">${t.label}</text>`;});
    for(let i=0;i<=5;i++) {
      const x=lo+span*i/5,px=xPos(x);
      svg+=`<line x1="${px}" y1="${margin.top+H}" x2="${px}" y2="${margin.top+H+5}" stroke="#c1ccd6"/><text x="${px}" y="${margin.top+H+20}" text-anchor="middle">${fmt(x)}</text>`;
    }
    svg+=`<line x1="${margin.left}" y1="${margin.top+H}" x2="${width-margin.right}" y2="${margin.top+H}" stroke="#bfcbd5"/><text x="${margin.left+W/2}" y="${height-4}" text-anchor="middle" class="axis-title">${config[family].axis}</text><g clip-path="url(#plot-clip)">`;
    const paths=curves.map(c=>{
      const ax=c.axis?right:left;
      const path=xs.map((x,i)=>`${i?"L":"M"}${xPos(x).toFixed(2)},${ax.position(c.logs[i]).toFixed(2)}`).join("");
      if(c.fill)svg+=`<path d="${path}L${xPos(hi)},${margin.top+H}L${xPos(lo)},${margin.top+H}Z" fill="${c.fill}" fill-opacity="${c.opacity}"/>`;
      return {c,path};
    });
    // The likelihood's dashes remain visible when a flat prior makes the
    // posterior coincide exactly with the normalized likelihood.
    paths.sort((a,b)=>Number(a.c.fn===likelihood)-Number(b.c.fn===likelihood)).forEach(({c,path})=>{
      svg+=`<path d="${path}" fill="none" stroke="${c.color}" stroke-width="${c.width}" ${c.dash?`stroke-dasharray="${c.dash}"`:""} stroke-linejoin="round"/>`;
    });
    svg+='</g><g id="hover" pointer-events="none" visibility="hidden"></g>';
    svg+=`<rect id="plot-hit" x="${margin.left}" y="${margin.top}" width="${W}" height="${H}" fill="transparent" style="cursor:crosshair"/></svg>`;
    container.innerHTML=svg;
    $("boundary-note").hidden=!(current.singular||reference?.singular);
    $("scale-note").textContent=(actual?"Actual likelihood on the right axis; densities on the left.":"Likelihood rescaled to area 1; evidence uses its actual value.")+(logScale?" Six decades shown.":"");
    const hit=$("plot-hit"),hover=$("hover");
    hit.addEventListener("pointermove",e=>{
      const bounds=container.getBoundingClientRect(), px=Math.max(margin.left,Math.min(width-margin.right,e.clientX-bounds.left));
      const x=lo+(px-margin.left)/W*span,boxW=158,boxX=Math.max(margin.left,Math.min(width-margin.right-boxW,px+12));
      const rows=[["θ",fmt(x),"#173554"],["Prior",logFmt(current.priorLog(x)),"#8261b8"],["L (actual)",logFmt(current.likelihoodLog(x)),"#c27a24"],["Posterior",logFmt(current.posteriorLog(x)),"#168775"]];
      hover.innerHTML=`<line x1="${px}" y1="${margin.top}" x2="${px}" y2="${margin.top+H}" stroke="#a5b3bf" stroke-dasharray="3 4"/><rect x="${boxX}" y="${margin.top+8}" width="${boxW}" height="94" rx="6" fill="white" stroke="#d9e2e9"/>`+rows.map(([name,value,color],i)=>`<text x="${boxX+10}" y="${margin.top+27+i*19}" class="tooltip-text" style="fill:${color}">${name}</text><text x="${boxX+boxW-10}" y="${margin.top+27+i*19}" text-anchor="end" class="tooltip-text">${value}</text>`).join("");
      hover.setAttribute("visibility","visible");
    });
    hit.addEventListener("pointerleave",()=>hover.setAttribute("visibility","hidden"));
  }
  function superscript(n) {return String(n).split("").map(c=>"⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)]||"⁻").join("");}
  $("model").addEventListener("change",()=>{family=$("model").value;reset();});
  $("reset").addEventListener("click",reset);
  $("pin").addEventListener("click",()=>{pinned={...prior};update();});
  document.querySelectorAll("[data-preset]").forEach(b=>b.addEventListener("click",()=>preset(b.dataset.preset)));
  $("likelihood-scale").addEventListener("change",queueDraw);
  ["linear","log"].forEach(id=>$(id).addEventListener("click",()=>{
    logScale=id==="log";$("linear").setAttribute("aria-pressed",String(!logScale));$("log").setAttribute("aria-pressed",String(logScale));queueDraw();
  }));
  new ResizeObserver(queueDraw).observe($("plot"));
  renderControls();update();
})();
