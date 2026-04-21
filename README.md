# Explanations

- counterpoint58_new_rules.du is updated with the corrected rules, except the "directFifth/directOctave".
- counterpoint_forbid.du is rewritten without using judgeCP, and it is default solver to be used in the JS files currently.
- divide-and-conquer folder contains the divide and conquer approach in JS, and three seperate Dusa files for the start, middle, and the end of the piece. I hope the parsing issue is solved and it can be run as:
```
node .\divide_and_generate.mjs
```

- Validation code is also updated in the "testing.mjs". It uses the input cf from the file "song_testing.du". To run the validation code:
```
node .\testing.mjs
```



# To Test It Out

I advise anyone who wants to see the behaviour to copy the contents of the "counterpoint_forbid.du" and a valid input into "dusa.rocks" and run it there. But it can be run with the below command from the terminal as well.

```
node .\out2mid.mjs
```


- It takes between 30 seconds to 1 minute to generate an output on average, and it is relatively heavy on memory.

- I included one generated output named "example_solution.mid", and its text format as "example_solution.txt".

- Below is the input from "song.du" to test in "dusa.rocks" for convenience:

```
cf 46 is 0.
cf 45 is 1.
cf 44 is 1.
cf 43 is 2.
cf 42 is 2.
cf 41 is 3.
cf 40 is 3.
cf 39 is 0.
cf 38 is 4.
cf 37 is 5.
cf 36 is 5.
cf 35 is 4.
cf 34 is 4.
cf 33 is 0.
cf 32 is 0.
cf 31 is 0.
cf 30 is 1.
cf 29 is 2.
cf 28 is 2.
cf 27 is 3.
cf 26 is 3.
cf 25 is 4.
cf 24 is 4.
cf 23 is 0.
cf 22 is 1.
cf 21 is 2.
cf 20 is 2.
cf 19 is 3.
cf 18 is 3.
cf 17 is 4.
cf 16 is 4.
cf 15 is 0.
cf 14 is 0.
cf 13 is 1.
cf 12 is 1.
cf 11 is 2.
cf 10 is 2.
cf 9 is 3.
cf 8 is 3.
cf 7 is 0.
cf 6 is 4.
cf 5 is 5.
cf 4 is 5.
cf 3 is 4.
cf 2 is 4.
cf 1 is 0.
cf 0 is 0.
length is 46.
```
(Twinkle Twinkle from "song.du" with the last cf changed to fit the cadence specification)


