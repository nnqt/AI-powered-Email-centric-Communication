# Thesis Writing Conventions

## Template: `bkthesis.sty`

Source: `thesis-template-master/bkthesis.sty` (by thanhhungqb@gmail.com)

### Page Layout
- A4 paper, 12pt, `book` class, `oneside`
- Margins: left=30mm, top=20mm, text area=160mm×247mm
- Font: `mathptmx` (Times New Roman equivalent)

### Cover Page Commands
```latex
\title{Nền tảng quản lý trao đổi Email và mở rộng đa kênh ứng dụng AI}
\cstuname{SVTH: Ngô Nguyễn Quốc Thịnh}
\csSupervise{ThS. Võ Thanh Hùng}
\csReviewer{TS. Nguyễn Quốc Minh}
\cttime{12/2025}
```

### Custom Environments
- `\begin{declaration}...\end{declaration}` — Lời cam đoan
- `\begin{acknowledgments}...\end{acknowledgments}` — Lời cảm ơn
- `\begin{abstract}...\end{abstract}` — Tóm tắt nội dung

### Document Structure
```latex
\frontmatter     % declaration, acknowledgments, abstract, TOC
\mainmatter      % chapters
\input{manually.bbl}  % bibliography (manual, not BibTeX)
```

## Chapter Labeling Convention

| Chapter | Label | File |
|---------|-------|------|
| 1 | `\label{sec:TongQuan}` | `Chapter1-Overview.tex` |
| 2 | `\label{sec:YeuCau}` | `Chapter2-RequirementAnalysis.tex` |
| 3 | `\label{sec:TechStack}` | `Chapter3-AIAndLLM.tex` |
| 4 | `\label{sec:ThietKe}` | `Chapter4-SystemDesign.tex` |
| 5 | `\label{sec:HienThuc}` | `Chapter5-ImplementAndTesting.tex` |
| 6 | `\label{sec:KetLuan}` | `Chapter6-Conclusion.tex` |

## Code Listings Style

Already defined in `thesisdemo.tex` as `CStyle`:
```latex
\lstdefinestyle{CStyle}{
  backgroundcolor=\color{backgroundColour},
  commentstyle=\color{mGreen},
  keywordstyle=\color{red},
  basicstyle=\footnotesize,
  breaklines=true,
  language=C
}
```

When inserting code, use:
```latex
\begin{lstlisting}[style=CStyle, language=Python, caption={...}, label={lst:...}]
...
\end{lstlisting}
```

## Image Handling

- Images stored in: `thesis-template-master/Images/`
- Graphics path set: `\graphicspath{{Images/}}`
- Use `[H]` placement from `float` package (already loaded):
```latex
\begin{figure}[H]
  \centering
  \includegraphics[width=0.8\textwidth]{filename.png}
  \caption{...}
  \label{fig:...}
\end{figure}
```

## Bibliography

Currently uses **manual bibliography** (`manually.bbl`) instead of BibTeX auto-generation:
```latex
\input{manually.bbl}
```

A `refs.bib` file also exists but is not loaded via `\bibliography{}`. When adding citations:
1. Add BibTeX entry to `refs.bib` (for reference tracking)
2. Add formatted entry to `manually.bbl` (for actual compilation)
3. Use `\cite{key}` in text

## Vietnamese Academic Style Notes

- Section numbering depth: 2 (`\setcounter{secnumdepth}{2}`)
- TOC depth: 2 (`\setcounter{tocdepth}{2}`)
- Vietnamese encoding: `\usepackage[utf8]{vietnam}`
- Hyperlinks: black color (academic convention)
