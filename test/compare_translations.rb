#!/usr/bin/env ruby

require 'json'

##make this nested
def compareKeys
    langs = ["de", "en"]
    langDependentKeys = ["Combatskilldescr", "Racedescr","ReverseSpellRanges", "SKILLdescr"]

    json = {}
    langs.each do |lang|
        json[lang] = JSON.parse(File.read("../lang/#{lang}.json")).flatten_with_path
    end
    ref = "de"

    langs.each do |lang|
        notInLang = json[ref].keys - json[lang].keys
        notInLang.reject!{|e| e =~ /^(#{langDependentKeys.join("|")})/}
        puts "Keys not in #{lang} translation:\n#{notInLang.join("\n")}\n\n\n" if notInLang.any?
        notInRef = json[lang].keys - json[ref].keys
        notInRef.reject!{|e| e =~ /^(#{langDependentKeys.join("|")})/}
        puts "Keys of lang #{lang} not in reference #{ref} translation:\n#{notInRef.join("\n")}\n\n\n" if notInRef.any?
    end

    puts "\n\n##################################################\n\n"
    langs.each do |lang|
        emptyKeys = json[lang].select{|key,val| val == ""}
        puts "Empty keys in lang #{lang}: \n#{emptyKeys.keys.join("\n")}" if emptyKeys.any?
    end
    
    langDependentKeys.each do |x|
        refS = json[ref].keys.select{|e| e =~ /#{x}/}.count   
        langs.each do |lang|
            puts "#{x} key count of lang #{lang} not matching." if (refS - json[lang].keys.select{|e| e =~ /#{x}/}.count != 0)
        end
    end

    ###TODO find duplicate values and refactor
    #puts "\n\n\n"
    #x = "SKILLdescr"
    #de = json[ref].select{|e| e =~ /^#{x}/}.map{|e, val| e.split('.')[1]}
    #en  = json["en"].select{|e| e =~ /^#{x}/}.map{|e, val| e.split('.')[1]}
    #de.each_with_index do |n, index|
    #    puts "\"#{n}\": \"#{en[index]}\","
    #end
    #puts json[ref].select{|e| e =~ /^Combatskilldescr/}.map{|e, val| "\"#{e.split('.')[1]}\": \"\","}.join("\n")
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

        key = parent_prefix ? "#{parent_prefix}.#{k}" : k 

        if v.is_a? Enumerable
            res.merge!(v.flatten_with_path(key))
        else
            res[key] = v
        end
        end

        res
    end
end

compareKeys