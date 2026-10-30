/* Normalized distributions and conjugate updates. No network or dependencies. */
"use strict";
window.Bayes = (() => {
  const C = [676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7];
  function logGamma(z) {
    if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI*z)) - logGamma(1-z);
    z -= 1;
    let x = .9999999999998099;
    C.forEach((c,i) => { x += c/(z+i+1); });
    const t = z + 7.5;
    return .5*Math.log(2*Math.PI) + (z+.5)*Math.log(t)-t+Math.log(x);
  }
  const logBeta = (a,b) => logGamma(a)+logGamma(b)-logGamma(a+b);
  function betaLog(x,a,b) {
    if (x<0 || x>1) return -Infinity;
    if (x===0) return a===1 ? -logBeta(a,b) : (a<1 ? Infinity : -Infinity);
    if (x===1) return b===1 ? -logBeta(a,b) : (b<1 ? Infinity : -Infinity);
    return (a-1)*Math.log(x)+(b-1)*Math.log1p(-x)-logBeta(a,b);
  }
  function gammaLog(x,a,rate) {
    if(x<0) return -Infinity;
    if(x===0) return a===1 ? Math.log(rate) : (a<1 ? Infinity : -Infinity);
    return a*Math.log(rate)-logGamma(a)+(a-1)*Math.log(x)-rate*x;
  }
  const normalLog = (x,mean,sd) => -.5*Math.log(2*Math.PI)-Math.log(sd)-.5*((x-mean)/sd)**2;
  function model(family,prior,data) {
    if(family === "beta") {
      const {a,b}=prior, {k,n}=data;
      const logZ=logGamma(n+1)-logGamma(k+1)-logGamma(n-k+1)+logBeta(a+k,b+n-k)-logBeta(a,b);
      return {logZ, priorLog:x=>betaLog(x,a,b), posteriorLog:x=>betaLog(x,a+k,b+n-k),
        likelihoodLog:x=>betaLog(x,k+1,n-k+1)-Math.log(n+1),
        likelihoodDensityLog:x=>betaLog(x,k+1,n-k+1),
        priorMean:a/(a+b), posteriorMean:(a+k)/(a+b+n), estimate:k/n,
        priorDescription:`Beta(${a}, ${b})`, posteriorDescription:`Beta(${a+k}, ${b+n-k})`,
        bounds:[0,1], singular:a<1||b<1,posteriorSingular:a+k<1||b+n-k<1};
    }
    if(family === "gamma") {
      const {a,scale}=prior, {k,t}=data, rate=1/scale, postRate=rate+t;
      const logZ=logGamma(a+k)-logGamma(a)-logGamma(k+1)+a*Math.log(rate)+k*Math.log(t)-(a+k)*Math.log(postRate);
      const end=(shape,r)=>shape/r+8*Math.sqrt(shape)/r;
      return {logZ,priorLog:x=>gammaLog(x,a,rate),posteriorLog:x=>gammaLog(x,a+k,postRate),
        likelihoodLog:x=>gammaLog(x,k+1,t)-Math.log(t),likelihoodDensityLog:x=>gammaLog(x,k+1,t),
        priorMean:a*scale,posteriorMean:(a+k)/postRate,estimate:k/t,
        priorDescription:`Gamma(${a}, ${scale})`, posteriorDescription:`Gamma(${a+k}, ${(1/postRate).toPrecision(3)})`,
        bounds:[0,Math.max(end(a,rate),end(a+k,postRate),end(k+1,t))],singular:a<1,posteriorSingular:a+k<1};
    }
    const {mean,sd}=prior, {y,se}=data;
    const variance=1/(1/sd**2+1/se**2), postMean=variance*(mean/sd**2+y/se**2), postSD=Math.sqrt(variance);
    return {logZ:normalLog(y,mean,Math.hypot(sd,se)),priorLog:x=>normalLog(x,mean,sd),
      posteriorLog:x=>normalLog(x,postMean,postSD),likelihoodLog:x=>normalLog(x,y,se),likelihoodDensityLog:x=>normalLog(x,y,se),
      priorMean:mean,posteriorMean:postMean,estimate:y,
      priorDescription:`Normal(${mean}, ${sd})`,posteriorDescription:`Normal(${postMean.toPrecision(3)}, ${postSD.toPrecision(3)})`,
      bounds:[Math.min(mean-4.5*sd,y-4.5*se),Math.max(mean+4.5*sd,y+4.5*se)],singular:false};
  }
  return {logGamma,logBeta,betaLog,gammaLog,normalLog,model};
})();
