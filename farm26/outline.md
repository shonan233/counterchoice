1. Introduction
- Finite-choice logic programming (Dusa) is a promising technology for procedural content generation
- But Dusa is very new, so there is a gap in the research literature: how do we develop end-user applications?
- We fill this gap by developing an end-user counterpoint composition application with Dusa, which reveals:
  - How traditional counterpoint rules can and should be encoded as logic programs
  - How labor is divided between languages: how much can be implemented in Dusa and how much outside
  - How to address performance and functionality* needs during implementation
    * There must be a better word for this, but I am thinking how pieces with many repeated notes were generated, and these formally fit the rules but are intuitively bad music
2. Background

- Counterpoint
  - Examples of first species CP illustrating basic rules
  
- Dusa
  
- Personal anecdote (feel free to delete)
  When Rose took a harmony class ~14 years ago, she instinctively wanted to generate 4-part chorales
  in Prolog but did not know how. Now we finally have the technology to implement harmony.

3. Design and Implementation
- CP->LP (Counterpoint to Logic Program)
  - Deciding Interface / Problem Format
  - Naive Algorithm: Translating Rules to Code
  - Divide-and-Conquer
  - Pruning Search Space (Yigit's recent developments)
- LP-> UI
  - Identifying Design Goals
  - Wireframes
  - Components + Libraries Used
   
4. Discussion
- Is Dusa particularly good for harmony?
- How much work, if any, does Dusa save? How much, if at all, does that matter?
- Is Dusa debuggable? Optimizable?

5. Related Work

- Cite human-computer co-creativity work?
- Cite yourselves as appropriate
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
- Weighted + prioritized constraints
- 4 part chorale
- Use procedurally generated music to do something that's impossible without procedural generation
  - Self-study applications for students in music theory classes?
- Use what we learned to develop an interactive debugger for logic programs