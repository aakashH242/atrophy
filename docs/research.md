# The research behind Atrophy

The product thesis: AI-assisted work erodes unaided skill, the erosion is
measurable, and there is no internal warning signal - you *feel* faster while
getting worse. Four studies, four domains, same shape:

## 1. Clinicians - the deskilling signal is real and fast

**Budzyń K, Romańczyk M, Kitala D, et al.** "Endoscopist deskilling risk after
exposure to artificial intelligence in colonoscopy: a multicentre, observational
study." *The Lancet Gastroenterology & Hepatology*, August 2025.
<https://www.thelancet.com/journals/langas/article/PIIS2468-1253(25)00133-5/abstract>

19 experienced endoscopists (2,000+ colonoscopies each) across four centres.
After a few months of routine AI assistance, their **unaided** adenoma detection
rate fell from **28.4% to 22.4%** - a 6-point absolute drop in detecting
precancerous growths, when the AI was simply switched off. First real-world
clinical evidence of AI-driven deskilling.

## 2. Students - the crutch effect survives the crutch

**Bastani H, Bastani O, Sungu A, Ge H, Kabakcı Ö, Mariman R.** "Generative AI
without guardrails can harm learning: Evidence from high school mathematics."
*PNAS* 122 (2025). <https://www.pnas.org/doi/10.1073/pnas.2422633122>

~1,000 high-school students, randomized. GPT-4 access improved practice
performance - but when access was removed, the unrestricted-GPT group scored
**17% worse** than students who never had it. Guardrailed hints (tutor mode)
erased the harm. Unaided testing is what exposed the gap.

## 3. Developers - no internal warning signal

**Becker J, Rush N, Barnes E, Rein D (METR).** "Measuring the Impact of
Early-2025 AI on Experienced Open-Source Developer Productivity." July 2025.
<https://arxiv.org/abs/2507.09089>

RCT, 16 experienced maintainers, 246 real tasks in repos they knew well. With
AI tools they were **19% slower** - while predicting 24% speedup beforehand and
still *believing* they'd been ~20% faster afterwards. A 39-point gap between
perception and measurement: your own sense of productivity is not a sensor you
can trust.

## 4. Developers - comprehension drops ~17%, debugging worst

**Anthropic.** "How AI assistance impacts the formation of coding skills."
February 2026. <https://www.anthropic.com/research/AI-assistance-coding-skills>

RCT, 52 engineers learning an unfamiliar Python library. AI-assisted
participants finished in about the same time but scored **17% lower** on the
follow-up comprehension quiz (50% vs 67%), with the **largest decline in
debugging** - exactly the axis this tool drills hardest. Passive delegation
("just make it work") hurt far more than question-driven AI use.

## What Atrophy measures vs. what it claims

Micro-drills are a **proxy** for real-world unaided skill, not a clinical
instrument. Practice effects are real and expected - the drill *is* the
maintenance, so improving at drills is the point, not a confound to hide.
What the charts honestly distinguish:

- **Rating** only moves on evidence (a graded rep).
- **Confidence (RD)** decays with inactivity - the "cracking" band says
  "untested lately," never "you got worse."
- The **AI-on vs AI-off divergence** is the closest thing to study #3's gap
  you can plot on yourself: same drills, with and without your tools.

None of this claims validity beyond that. The studies above justify measuring;
they don't certify this particular ruler.
