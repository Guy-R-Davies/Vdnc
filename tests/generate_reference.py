"""Regenerate independent numeric references: python with SciPy installed."""
import json
from pathlib import Path
from scipy.stats import beta, binom, betabinom, gamma, poisson, norm, nbinom

cases = []
for a, b, k, n, x in [(1, 1, 8, 12, .5), (.1, .1, 0, 200, .0001),
                         (60, .1, 0, 200, .8), (60, 60, 200, 200, .99),
                         (4.5, 8.2, 9, 12, .7)]:
    cases.append(dict(family="beta", prior=dict(a=a, b=b), data=dict(k=k, n=n), x=x,
                      logZ=betabinom.logpmf(k, n, a, b),
                      priorLog=beta.logpdf(x, a, b), posteriorLog=beta.logpdf(x, a+k, b+n-k),
                      likelihoodLog=binom.logpmf(k, n, x)))
for a, scale, k, t, x in [(2, 2, 6, 2, 3), (.1, .05, 50, 20, .03),
                              (.1, 5, 0, .1, .0001), (30, 5, 0, 20, 1)]:
    cases.append(dict(family="gamma", prior=dict(a=a, scale=scale), data=dict(k=k, t=t), x=x,
                      logZ=nbinom.logpmf(k, a, 1/(1+t*scale)),
                      priorLog=gamma.logpdf(x, a, scale=scale),
                      posteriorLog=gamma.logpdf(x, a+k, scale=1/(1/scale+t)),
                      likelihoodLog=poisson.logpmf(k, x*t)))
for mean, sd, y, se, x in [(0, 3, 2, .5, 1), (-10, .1, 5, .05, 4),
                               (0, .1, 0, .05, 0), (10, 10, -5, 3, -1)]:
    var = 1/(1/sd**2+1/se**2)
    post_mean = var*(mean/sd**2+y/se**2)
    cases.append(dict(family="normal", prior=dict(mean=mean, sd=sd), data=dict(y=y, se=se), x=x,
                      logZ=norm.logpdf(y, mean, (sd**2+se**2)**.5),
                      priorLog=norm.logpdf(x, mean, sd),
                      posteriorLog=norm.logpdf(x, post_mean, var**.5),
                      likelihoodLog=norm.logpdf(y, x, se)))
Path(__file__).with_name("reference.json").write_text(json.dumps(cases, indent=2)+"\n")
