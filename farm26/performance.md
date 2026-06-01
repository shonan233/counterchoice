# Performance: CounterChoice

This performance is a companion to our paper submission titled "CounterChoice: Counterpoint Composition in Dusa with a Firmus Foundation". CounterChoice is a mixed-initiative creative application which creates a first-species counterpoint composition together with its user. The user provides the first voice, the cantus firmus, through a graphical interface provided as a web application, and CounterChoice generates the counterpoint voice using a logic program written in the finite-choice logic programming language Dusa. The resulting composition is presented both as playable audio and as Dusa code, at which point the user may continue to edit and revise via the same interaction loop. In this performance, we compose counterpoint for several cantus firmi through interaction with CounterChoice.

CounterChoice centers around a Dusa logic program that encodes the rules of first-species counterpoint as constraints between a cantus firmus and a counterpoint melody represented as logical predicates. For a fixed cantus firmus, solutions of this Dusa program contain valid counterpoint lines for the given melody.

For our performance, we only need facilities for projecting the graphical interface and for playing generated counterpoint. Since CounterChoice works on a browser, we can use either our own laptop or a device provided by the workshop.

CounterChoice is hosted at https://shonan233.github.io/counterchoice/.
A short demo can be found at https://www.youtube.com/watch?v=4QupZkOGR60.