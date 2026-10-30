# Vdnc — Bayesian updating

A small, static Bayesian demonstrator. Prior, likelihood, posterior, and exact evidence update entirely in the browser. No dependencies, build step, accounts, or external requests.

## Local preview

From this directory:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765>. The root `index.html` also works directly from disk.

## Experiments

| Experiment | Prior | Likelihood | Posterior | Evidence |
| --- | --- | --- | --- | --- |
| Coin tosses | Beta(α, β) | Binomial(n, θ), observing k heads | Beta(α+k, β+n−k) | C(n,k) B(α+k, β+n−k) / B(α,β) |
| Arrivals per hour | Gamma(shape α, scale s) | Poisson(λT), observing k arrivals over T hours | Gamma(α+k, s/(1+sT)) | Γ(α+k)/(Γ(α) k!) × (Ts)^k/(1+Ts)^(α+k) |
| A noisy measurement | Normal(μ, σ), with σ a standard deviation | Normal(θ, σₑ), observing y | Normal(m, √v), where v = (σ⁻²+σₑ⁻²)⁻¹ and m = v(μ/σ²+y/σₑ²) | Normal density at y with mean μ and standard deviation √(σ²+σₑ²) |

For coins, the data are the **count** of heads, rather than a particular ordered sequence: the likelihood and evidence include the binomial coefficient. For arrivals, the data are the **total count** over the chosen exposure. These evidences are probabilities. For a continuous measurement the evidence is a **density**, can exceed one, and has units inverse to those of y.

The four prior presets let you explore width and agreement with the data. **Pin this prior**, then change its parameters to compare the current evidence with the pinned prior's evidence. Both use the current data; changing data recomputes both. The ratio is a Bayes factor between the two fixed prior specifications, with the same likelihood. Switching experiments or resetting clears the pin. Presets depend on the current data to provide illustrative shapes; evidence after such tuning is an educational comparison, not an independent assessment of a prior chosen before observing the data.

## Plot scales

The default **unit-area likelihood** compares the three shapes on one density axis. Its normalization uses the entire parameter support, even if the chart displays only part of a tail. **Actual likelihood** uses a separate right axis; densities remain on the left. The hover readout always gives the actual likelihood. Neither display setting changes the evidence.

**Log** displays six decades below the rounded peak on each active axis. Infinite Beta/Gamma endpoint peaks are clipped and labelled. The horizontal range includes the prior, posterior, likelihood, and pinned prior; unbounded distributions have truncated display ranges. Normalization and evidence use full-support analytic expressions, independent of plotting limits and sampling resolution. Log-domain calculations and scientific notation preserve extremely small evidence values.

## Validation

With a local preview running, open <http://127.0.0.1:8765/tests/>. The browser suite checks independent SciPy reference values, numerical integrals, the Bayes identity, parameter constraints, prior comparisons, display scaling, singular endpoints, extreme evidence, and mobile layout.

To run automatically with Chrome/Chromium:

```sh
python3 tests/run_browser.py --browser '/path/to/chrome' --screenshots
```

Reference values are committed in `tests/reference.json`; regenerating them requires SciPy (`python3 tests/generate_reference.py`). The application and browser suite do not require SciPy or Python packages.

Distribution definitions: [SciPy Beta](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.beta.html), [Beta–Binomial](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.betabinom.html), [Gamma](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gamma.html), [Poisson](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.poisson.html), and [Normal](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norm.html).

## GitHub Pages

The site is published at <https://guy-r-davies.github.io/Vdnc/>. The root `index.html`, `style.css`, `math.js`, and `app.js` are static files. All asset paths are relative so a repository subpath works.

After changing an asset, run `python3 scripts/version_assets.py` before committing. This updates the content-based versions in `index.html` so a deployment requests the matching CSS and JavaScript instead of cached files. The browser test runner checks these versions before running. Summary updates also support the original HTML IDs while older pages remain cached.
