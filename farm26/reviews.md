FARM 26 Paper #70 Reviews and Comments
===========================================================================
Paper #70 CounterChoice: Counterpoint Composition in Dusa with a Firmus
Foundation


Review #70A
===========================================================================

Overall merit
-------------
4. Accept

Reviewer expertise
------------------
3. Knowledgeable

Paper summary
-------------
This paper presents the design, implementation and motivation for CounterChoice, an online system for writing counterpoint compositions. Interestingly, the backend is implemented using Dusa, an experimental functional-logic language. The paper presents the implementation of the counterpoint rules in Dusa, the design and implementation of the overall application (including JS front-end), and a wider discussion exploring the possibilities of programming languages impacting artistic design and exploration.

Comments for authors
--------------------
## Overall recommendations

I recommend that this paper is accepted at FARM.

+ The paper presents a complete and comprehensive working application using Dusa. Although the emphasis of Dusa is perhaps more 'logical' (or functional-logic) than merely 'functional' it is clearly in scope for a workshop such as FARM. The paper not only contributes the encoding of the counterpoint rules in Dusa, but also discusses the engineering work necessary to incorporate this in a working application.

+ The paper touches upon the wider discussion of how programming languages can facilitate and enhance artistic exploration. This makes the work highly relevant for FARM. I am hopeful that the paper might spark wider discussion on this subject at the workshop itself and inspire further work in this area.

I have a few suggestions for further work and clarifications that I would like to see for the final version of this paper, listed below. I do not have any concerns about the validity of these results.

* Further work - Dusa is a functional logic language. It seems natural to (lazily) generate _all_ counterpoint voices, allowing the user to compare different solutions and interactively explore the design space. The current UI shows multiple solutions - but limited ways to really interactively explore the design space. Ideally, I'd want like to add further constraints -- for example, fixing some notes in the counterpoint voice and seeing what valid solutions exist (if any). Or perhaps ruling out certain choices of notes in the counterpoint voice. Is this something that is technically feasible in the current set-up? Or do the authors have any thoughts in this direction?

* I played around with the current implementation. A naive user may all too easily enter notes without valid counterpoint voice. This raised a more interesting technical question: can you check feasibility of the input voice efficiently - without having to search for all solutions? Can you extract such a feasibility check from the Dusa spec? Can you incorporate the feasibility back in the UI -- making it impossible to enter infeasible inputs? 

* Are there any 'lessons learned' that the authors can share about debugging performance of Dusa programs? (See the discussion around line 888). It seems like there was some non-trivial engineering and performance debugging involved - yet the discussion is fairly high level. Can you give some further insight/motivation for why the #forbidden vs judgeCP has better/worse performance - especially for readers unfamiliar with Dusa.

## Minor suggestions and typos

l 120 "but it is so new that it lacks established demonstrator applications."  -> this sounds like you're subverting your own claim. Perhaps you might consider phrasing this more positively, as 'breaking new ground' or 'demonstrating the viability of this approach'?

l 144 - "Choice inform design" -> "choice inform the"

l 220 When introducing Dusa - many readers will be familiar with Prolog. Can you sketch/summarise the main differences? What is the key motivation for developing a new language?

l 246-247 - perhaps quote explicitly, writing ':-' and ','

l 280 - what is the purpose of open rules? Can you give a motivating example? If they can be overridden by other rules -- what do they add?

l 719 - "but presented immutably." - I was confused here... Am I right in understanding that the user cannot tweak the generated counterpoint? 'Immutable' has a certain technical connotation (immutable data structures) -- perhaps there is a synonym you might choose that fits better.

l 888 Can you say something about speed? I'm not looking for benchmarks -- but a rough number of how long you need to wait to generate (all) solutions? The current implementation is capable of solving up to 50 notes -- but does that take seconds, minutes or hours?

l 860 - It is interesting that Javascript caught bugs... We usually think of declarative languages as being more readable and closer to the human specification. Is there a more general lesson to be learned here? Why do we need imperative languages - such as Javascript - to debug our beautiful declarative executable specifications? Perhaps one might state more broadly that validation and testing against logical errors in the specification remains important.

l 1088 - why can't the divide and conquer approach be implemented in Dusa? Surely you could have the GUI generate the relevant Dusa program with suitable 'chunks' and 'overlap'? The current implementation sets a fixed number of variables 'cf 0 is ...' up to 'cf 7 in ...' -- could you not generate (overlapping) chunks of variables in a similar fashion?



Review #70B
===========================================================================

Overall merit
-------------
5. Strong accept

Reviewer expertise
------------------
4. Expert

Paper summary
-------------
The paper describes the CounterChoice application. Given a cantus firmus, the
software will fill in the additional counterpoint melodies using logic
programming. However, the use of logic programming is, in some sense, an
implementation detail for what is a creativity support tool. The software
provides a user interface which has the declarative rules of species
counterpoint behind the scenes. CounterChoice also serves as demonstration
software for Dusa, which is a finite-choice logic programming language.

They present their work through the lens of three research questions, RQ[1-3],
which are detailed in Section 1.

Section 3 details the implementation/encoding of CPE counterpoint rules into
Dusa. While many of the rules are a straightforward encoding, the authors show
that having _some_ understanding of the unerlying system (Dusa) is a
significant benefit. Certain `#demand` rules are encoded as `#forbid` in order
to facilitate the search.

Section 4 describes the frontend design. In addition to the textual
description, they provided a link to a demo instance of the application.

Section 5 provides a discussion of the work, via the use of the Research
Questions stated previously.


Section 6 has a discussion of related work and Section 7 concludes.

Comments for authors
--------------------
I found the work interesting and relevant to FARM. The demo application was
quite fun and while it had me recalling memories of the Google Back doodle,
this work showed that you can actually do that and be faithful to the rules of
counterpoint! (I may be bitter toward Google for that...).

I do wish there was slightly more discussion on some of the rule optimizations,
especially on how you determine which `#demand` rules should be converted to
`#forbid`s, but I understand that space is at a premium.

Overall the only weakness of the paper is that there is only so much I can
transfer to another domain. There's a real tension between 'describe the system
we built', which was done wonderfully, and 'the reader will be able leverage
this insight for some other problem when using Dusa'. There wasn't _zero_ of
this, the implementation/design recommendations were great, I just wish there
had been more of that throughout. 


Some thoughts I had along the way:

--- 
In Section 3, page 4, line 403, you say

> we found it useful to center our Dusa implementation around this restriction

Was it useful _for you_, or useful _for Dusa_? I'm guessing the latter, but
let's say that this fact didn't occur to the user, would it still work (but
slower)?

---

You have predicates for the interval of the counterpoint melody, and then you
define a predicate `cpNote` to determine the note of the counterpoint melody.
As far as I can tell, this is for use-interface reasons and does not assist
with the search in any way?

---

I really like the *design recommendations* that were stated in Section 5 for RQ3.

---

Regarding the Divide-and-Conquer strategy, I'd be curious to know what changes
would be required in Dusa in order to support that strategy based on some
dimension (like how time is reprsented in the encoding described).

Minor nits:

> A key rule of counterpoint is that the interval between the cantus firmus and
> counter- point must be consonant, namely a unison, third, fifth, sixth, or
> octave.

I believe this is only true of first species counterpoint, but I guess the
whole application assumes first species...



Review #70C
===========================================================================

Overall merit
-------------
4. Accept

Reviewer expertise
------------------
3. Knowledgeable

Paper summary
-------------
CounterChoice is a browser-based tool for first-species counterpoint: the user enters a cantus firmus on a digital piano roll, and a logic program written in Dusa (a new logic programming language) synthesizes valid counterpoint voices, returned as playable audio and Dusa code that the user can iterate on. The paper's claimed contribution is not the counterpoint generator per se but the *case study* around it: it documents how faithfully counterpoint rules map onto Dusa's constraints (RQ1), how the frontend and Dusa backend co-evolved (RQ2), and what the experience implies for logic-programming tool design generally (RQ3).  The authors provide concrete recommendations, such as about optimization, search-space inspectability, and static reachability warnings.

Comments for authors
--------------------
The paper is well written and easy to read.  Sitting at the intersection of functional/logic programming, music, and creativity-support tools, it is a natural fit for FARM.  I also appreciated that there's a real artifact that I could play with to see CounterChoice in action.

**The Dusa-vs-ASP framing is asserted more than demonstrated.** The paper repeatedly motivates Dusa as a response to "the promise and limitations of answer-set programming," and RQ1 is partly justified as helping assess "the cost and value of choosing Dusa vs. other programming languages." But there's no side-by-side: nothing concrete that ASP made awkward and Dusa made natural here, nor the converse. Since this is positioned as a demonstrator *for Dusa*, even a short qualitative comparison would substantially strengthen the central value proposition.

**The biggest gap is evaluation.** The tool is framed around casual creators, autotelic creativity, and mixed-initiative affordances, yet all evidence is the authors' own qualitative experience as developers. That's a legitimate and clearly-labeled choice, but the claims about accessibility "to users with little prior background in music" and a "tight feedback loop" are design *goals*, not findings. Even a small informal study (a handful of musicians and non-musicians) would let you say something evaluative about the interface rather than aspirational.

**The divide-and-conquer section felt out of place.** The honesty is commendable, but as written, the alternative-algorithm section reads as an interesting aside that slightly dilutes the paper's focus.

**RQ3 recommendations are sensible but somewhat generic.** "Avoid premature optimization," "allow RNG seeding," "make the search space inspectable," and "add static warnings for unreachable rules" are reasonable, but (mostly) common knowledge (you even admit this about premature optimization). The most distinctive one is the observation that *failing* branches of search dominate program behavior and are largely uninspectable. I suggest leading with and deepening that point; it's the recommendation most specific to logic-programming creativity tools and least likely to appear elsewhere.

**There's a bit of a gap in your references.** You did a great job with references on logic-programming and HCI/creativity, but I feel like you overlooked a few relevant papers in computational *music*. For instance, [Anders and Miranda's 2011 ACM Computing Surveys article](https://dl.acm.org/doi/pdf/10.1145/1978802.1978809) came up in my search, comparing generic music-constraint systems and noting that constraint programming's declarative, rule-as-specification style mirrors how music theory is traditionally written. There's also Ebcioğlu's work in the 1980s (e.g., https://quod.lib.umich.edu/i/icmc/bbp2372.1980.041/1 and https://quod.lib.umich.edu/i/icmc/bbp2372.1986.086/1) that seems very relevant. He created BSL, an efficient logic programming language, specifically for harmonizing four-part chorales. Lastly, I found that [Ovans and Davison (1992)](https://core.ac.uk/outputs/24336905/) built an interactive constraint-satisfaction system for first-species counterpoint with a GUI. Your version has new features compared to theirs (e.g., showing multiple valid solutions, a modern web interface), which would be easy to call out.

**Smaller points.** The static music-notation figures (the "good" vs. "bad" examples on p. 2) carry little weight in print since the audio is the real evidence.  Consider annotating them to highlight the specific parallel fifths/dissonances you reference, so the contrast is legible without leaving the page. The validation-via-reference-implementation and regression-testing methodology is a nice, underplayed strength worth a sentence more; that could even be another RQ3 result considering it's good advice for anyone building generative logic-programming tools.
