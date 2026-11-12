#!/bin/sh
# usage: zoom.sh <ref.png> <model.png> <w:h:x:y> <out.png> [scale]
s=${5:-1}
ffmpeg -v error -y -i $1 -i $2 -filter_complex "[0]crop=$3,drawgrid=w=79:h=79:t=1:c=black@0.25,scale=iw*$s:ih*$s[a];[1]crop=$3,drawgrid=w=79:h=79:t=1:c=black@0.25,scale=iw*$s:ih*$s[b];[a][b]hstack" $4
