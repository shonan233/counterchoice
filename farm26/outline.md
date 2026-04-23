1. Introduction

2. Background

- Counterpoint
  - Examples of first species CP illustrating basic rules
  
- Dusa
  
3. Implementation
   
4. UI
   
5. Related Work

- [Schottstaedt 1984](https://ccrma.stanford.edu/files/papers/stanm19.pdf)
  "Automatic Species Counterpoint"
  - Implement Fux's rules in SAIL
  - Represent importance of rules as penalties 
    (e.g. `TwoSkipsPenalty = 1`, `ParallelFifthPenalty = Infinity`)

- [Yilmaz & Telatar 2010](https://www.sciencedirect.com/science/article/abs/pii/S0950705110000092)
  "Note-against-note two-voice counterpoint by means of fuzzy logic"
  - Distinguish between strict rules (e.g. parallel fifth) and fuzzy rules (e.g. leaps)
  - Compare select-the-best method and likelihood-based selection (the latter promotes creativity)

- [Boenn et al. 2011](https://dl.acm.org/doi/abs/10.1017/S1471068410000530)
  "Automatic Music Composition using Answer Set Programming"
  - Develop the Anton system for melodic, harmonic, and rhythmic composition
  - Implement Thakar’s counterpoint rules in AnsProlog
  - Provide output in Csound & Lilypond formats

6. Conclusion and Future Work