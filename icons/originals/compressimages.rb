#!/usr/bin/env ruby

Dir.glob('./*').select { |e| File.file? e }.reject{|e| e =~ /\.rb/}.each do |e|
  #`convert #{e} -set colorspace Gray -separate -average gray_#{File.basename(e)}`
  `cwebp #{e} -o output/#{e.split(".")[0..-2].join(".")}.webp`# -resize 50 50`
  `mv #{e} done/#{e}`	
end