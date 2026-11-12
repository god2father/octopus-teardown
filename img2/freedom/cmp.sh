#!/bin/sh
# usage: cmp.sh <renderdir> -> cmpA.png cmpB.png in that dir
d=$1
ffmpeg -v error -y -i rf.png -i $d/front.png -i rl.png -i $d/left.png -filter_complex "[0][1][2][3]hstack=4" $d/cmpA.png
ffmpeg -v error -y -i rb.png -i $d/back.png -i rq.png -i $d/q.png -filter_complex "[0][1][2][3]hstack=4" $d/cmpB.png
