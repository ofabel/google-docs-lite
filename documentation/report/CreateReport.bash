#!/bin/bash



# order of chapters
chapters=($(ls chapters/*.md));



# prepare images
echo -n 'preparing images ... ';
for i in images/*.plantuml; do
    plantuml -tsvg $i \
    || { echo -e "\n  failed to convert $i"; exit 1; };
done;
echo 'done';



# create document
echo -n 'creating document ... ';
pandoc \
    -M title='Projekttitel' \
    --toc \
    -N \
    -V lang=de \
    -V geometry:a4paper,margin=2.5cm \
    -o Report.pdf \
    ${chapters[@]};
echo 'done';



# clean up
echo -n 'cleaning up ... ';
rm images/*.svg
echo 'done';



exit 0;



