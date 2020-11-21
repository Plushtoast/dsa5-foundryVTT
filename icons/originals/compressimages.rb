#!/usr/bin/env ruby

Dir.glob('./*').select { |e| File.file? e }.reject{|e| e =~ /\.rb/}.each do |e|
  `cwebp #{e} -o output/#{e.split(".")[0..-2].join(".")}.webp`
  `mv #{e} done/#{e}`	
end