#!/usr/bin/env ruby

require 'json'

##make this nested
def compareKeys
    de = JSON.parse(File.read('../lang/de.json')).flatten_with_path
    en = JSON.parse(File.read('../lang/en.json')).flatten_with_path

    notInEn = de.keys - en.keys
    notInDe = en.keys - de.keys

    puts "Keys not in DE translation:\n#{notInDe.join("\n")}\n"
    puts "Keys not in EN translation:\n#{notInEn.join("\n")}"
end



module Enumerable
    def flatten_with_path(parent_prefix = nil)
        res = {}

        self.each_with_index do |elem, i|
        if elem.is_a?(Array)
            k, v = elem
        else
            k, v = i, elem
        end

        key = parent_prefix ? "#{parent_prefix}.#{k}" : k # assign key name for result hash

        if v.is_a? Enumerable
            res.merge!(v.flatten_with_path(key)) # recursive call to flatten child elements
        else
            res[key] = v
        end
        end

        res
    end
end

compareKeys