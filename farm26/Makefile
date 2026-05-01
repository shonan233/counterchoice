MAIN = main
TEX  = $(MAIN).tex
PDF  = $(MAIN).pdf

all: $(PDF)

$(PDF): $(TEX)
	pdflatex $(TEX)
	bibtex $(MAIN)
	pdflatex $(TEX)
	pdflatex $(TEX)

clean:
	rm -f *.aux *.bbl *.blg *.log *.out *.toc *.lof *.lot *.fls *.fdb_latexmk

distclean: clean
	rm -f $(PDF)