#!/usr/bin/env ruby

require 'json'


#data = JSON.parse()
data = []

class String
    def titleize
      split(/(\W)/).map(&:capitalize).join.gsub(/[ÄÖÜ]/){|e| e.downcase}.gsub(/[äöü][A-Z]{1,1}/){|e| e.downcase}
    end
  end

File.readlines('../packs/item_bu.db').each do |line|

   json = JSON.parse(line)
   json["name"] = json["name"].titleize
   data << json.to_json
end

File.open("../packs/item.db","w") do |f|
    f.write(data.join("\n"))
end
