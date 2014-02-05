/*globals doctored, Node, alert, console, rangy, $*/
(function(){
	"use strict";

    doctored.util = {
        debounce: function(fn, delay_in_milliseconds, context) {
            var timer = null;
            context = context || this;
            return function(){
                var args = arguments;
                clearTimeout(timer);
                timer = setTimeout(
                            function(){ fn.apply(context, args); },
                            delay_in_milliseconds
                        );
            };
        },
        this_function: function(fn, context){
            context = context || this;
            if(fn === undefined) {
                console.trace();
                alert("Error: this_function called with non-existant function. See console.log");
            }
            return function(){
                var args = arguments;
                fn.apply(context, args);
            };
        },
        non_breaking_space: "\u00A0",
        increment_but_wrap_at: function(current_value, wrap_at, increment_by){
            var amount = increment_by || 1;

            current_value += amount;
            if(current_value >= wrap_at) current_value = 0;
            return current_value;
        },
        display_types: { //TODO: remove this - is it even used?
            block:  "block",
            inline: "inline-block",
            table:  "table",
            row:    "row",
            cell:   "cell",
            root:   "root"
        },
        looks_like_html: function(html_string_fragment){
            // Note that we cannot really succeed at identifying HTML
            // from a mere fragment but it works most of the
            // time and it's useful for users

            return (
                html_string_fragment.indexOf("<!DOCTYPE html>") >= 0 ||
                html_string_fragment.indexOf("</html>") >= 0         ||
                html_string_fragment.indexOf("</p>") >= 0            ||
                html_string_fragment.indexOf("</a>") >= 0
            );
        },
        get_clipboard_xml_as_html_string: function(clipboard){
            var html_string = "",
                mimetypes_ordered_by_preference_last_most_prefered = ["Text", "text/plain", "text/html", "text/xml"],
                mimetype,
                i;

            for(i = 0; i < mimetypes_ordered_by_preference_last_most_prefered.length; i++){
                mimetype = mimetypes_ordered_by_preference_last_most_prefered[i];
                if(clipboard.types && clipboard.types.indexOf(mimetype) >= 0) {
                    html_string = clipboard.getData(mimetype);
                }
            }
            return html_string;
        },
        parse_attributes_string: function(attributes_string){
            // although it would be easier to use the browsers DOM
            // to parse the attributes string (e.g. in a detached element)
            // that would make it potentially exploitable
            // eg a string of "<a onload='alert(\'deal with it\')'/>"
            // so we're doing string parsing even though it's a bit weird
            var attributes_regex = /([\-A\-Za-z0-9_]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g, // via http://ejohn.org/files/htmlparser.js
                attributes = {};

            attributes_string.replace(attributes_regex, function(match, name){
                var value = arguments[2] ? arguments[2] :
                                arguments[3] ? arguments[3] :
                                    arguments[4] ? arguments[4] : name;

                attributes[name] = value;
            });
            return attributes;
        },
        convert_xml_to_doctored_html: function(xml, elements){
            return xml.replace(/<(.*?)>/g, function(match, contents, offset, s){
                var element_name,
                    attributes = "",
                    display = "block";

                if(match.substr(0, 2) === "</"){
                    return '</div>';
                } else if(match.indexOf(" ") === -1){
                    element_name = match.substr(1, match.length - 2);
                } else {
                    element_name = match.substr(1, match.indexOf(" ") - 1);
                    match = match.substr(match.indexOf(" "));
                    attributes = ' data-attributes="' +
                                 JSON.stringify( doctored.util.parse_attributes_string(match.substr(0, match.length - 1))).replace(/"/g, "&quot;") +
                                 '"';
                }

                if(elements[element_name]) display = elements[element_name].display;

                return '<div class="' + display + '" data-element="' + element_name + '"' + attributes + '>';
            });
        },
        sniff_display_type: function(node){
            //FIXME: remove this shit code
            if(!node) return;
            var className;
            switch(node.nodeType){
                case node.TEXT_NODE:
                    return Node.TEXT_NODE;
                case node.ELEMENT_NODE:
                    className = " " + node.className + " ";
                    if(       / block / .test(className)){
                        return doctored.util.display_types.block;
                    } else if(/ inline /.test(className) || / inline-block /.test(className)){
                        return doctored.util.display_types.inline;
                    } else if(/ table / .test(className)){
                        return doctored.util.display_types.table;
                    } else if(/ row /   .test(className)){
                        return doctored.util.display_types.row;
                    } else if(/ cell /  .test(className)){
                        return doctored.util.display_types.cell;
                    } else if(/ selection /  .test(className)){
                        return doctored.util.display_types.text_selection;
                    } else if(/ doctored /  .test(className)){
                        return doctored.util.display_types.root;
                    }

                    return alert("Unknown element type. className was " + className);
            }
            alert("Unknown element type. nodeName was " + node.nodeName);
        },
        descend_building_xml: function(nodes, depth){
            //FIXME: this is old code. It works but it's a bit shit. Fix it to note depend on display_type and instead just use classList.contains() directly
            var i,
                node,
                xml_string = "",
                data_element,
                text_node,
                display_type;
            
            if(depth === undefined) depth = 0;

            for(i = 0; i < nodes.length; i++){
                node = nodes[i];
                switch(node.nodeType){
                    case Node.ELEMENT_NODE:
                        data_element = node.getAttribute("data-element");
                        if(!data_element) continue;
                        display_type =doctored.util.sniff_display_type(node);
                        //if(depth === 0 && display_type === doctored.util.display_types.block){
                        //    xml_string += "\n";
                        //}
                        xml_string += "<" + data_element;
                        xml_string += doctored.util.build_xml_attributes_from_json_string(node.getAttribute("data-attributes"));
                        xml_string += ">";
                        if (node.hasChildNodes()) {
                            xml_string += doctored.util.descend_building_xml(node.childNodes, depth+1);
                        }
                        xml_string += "</" + data_element + ">";
                        if(depth === 0 && display_type === doctored.util.display_types.block){
                            xml_string += "\n";
                        }
                        break;
                    case Node.TEXT_NODE:
                        text_node = node.innerHTML || node.textContent || node.innerText;
                        if(text_node === undefined) break;
                        xml_string += text_node.replace(/[\n]/g, " ");
                        break;
                }
            }
            return xml_string;
        },
        build_xml_attributes_from_map: function(attributes){
            var attributes_string = "",
                key;
            
            for(key in attributes) {
                attributes_string += " " +
                                     key.toString() +
                                     "=\"" +
                                     attributes[key].replace(/"/g, "&quot;") +
                                     "\"";
            }
            return attributes_string;
        },
        build_xml_attributes_from_json_string: function(json_string){
            if(!json_string || json_string.length === 0) return "";
            return doctored.util.build_xml_attributes_from_map(JSON.parse(json_string));
        },
        offer_download: function(xml, filename){
            var blob = new Blob([xml], {type: "text/xml;charset=utf-8"});
            filename = filename || "download.xml";
            window.saveAs(blob, filename);
        },
        remove_old_selection: function(selection, instance){
            if(selection && selection.classList.contains("doctored-selection")) {
                //the element must still contain the "doctored-selection" class or else it's probably
                //been turned into an 'element' (in the Doctored sense -- part of the document
                // we generate rather than an element used to express text selection)
                $(selection).replaceWith(selection.childNodes); //todo replace with plain javascript
                delete instance.dialog.target;
                instance.dialog.style.display = "none";
            }
        },
        surround_selection_with_element: function(nodeName, classNames, instance, selection){
            var range = selection.getRangeAt(0).cloneRange(),
                element;
            
            if(range.toString().length === 0) return;
            element = document.createElement(nodeName);
            element.className = classNames;
            instance.dialog.target = element;
            try{
                range.surroundContents(element); //FIXME causes "BAD_BOUNDARYPOINTS_ERR: DOM Range Exception 1" when selecting across mutiple elements. e.g. the selection in the following structure where square brackets indicate selection "<p>ok[this</p><p>bit]ok</p>"
                selection.removeAllRanges();
                selection.addRange(range);
                selection.removeAllRanges();
            } catch(e) {
                selection.removeAllRanges();
                //TODO: display error message because of bad boundaries
                return;
            }
            
            return element;
        },
        display_element_dialog: function(target, dialog, mouse){
            dialog.format_chooser.style.display        = "none";
            dialog.format_chooser_label.style.display  = "none";
            dialog.linter_chooser.style.display        = "none";
            dialog.linter_chooser_label.style.display  = "none";
            dialog.element_chooser_label.style.display = "";
            dialog.attributes_div.style.display        = "";
            dialog.style.left = mouse.x + "px";
            dialog.style.top  = mouse.y + "px";
            dialog.style.display = "block"; //must be visible to obtain width/height
            dialog.mode = "editElement";
            dialog.target = target;
            doctored.util.set_element_chooser_to_element(target, dialog.element_chooser);
        },
        set_element_chooser_to_element: function(element, element_chooser){
            var data_element = element.getAttribute("data-element"),
                i;

            if(!data_element) {
                element_chooser.selectedIndex = 0;
                return;
            }
            for(i = 0; i < element_chooser.options.length; i++){
                if(element_chooser.options[i].text === data_element) {
                    element_chooser.selectedIndex = i;
                    return;
                }
            }
        },
        display_dialog_around_inline: function(inline, dialog, mouse){
            var offsets = $(inline).inlineOffset();

            offsets.mouse_differences = {before_x: Math.abs(mouse.x - offsets.before.left), after_x: Math.abs(mouse.x - offsets.after.left)};
            dialog.format_chooser.style.display = "none";
            dialog.format_chooser_label.style.display = "none";
            dialog.element_chooser_label.style.display = "none";
            dialog.linter_chooser.style.display = "none";
            dialog.linter_chooser_label.style.display = "none";
            dialog.attributes_div.style.display = "none";
            dialog.style.display = "block"; //must be visible to obtain width/height
            offsets.dialog = {width: dialog.offsetWidth, height: dialog.offsetHeight};
            if(offsets.mouse_differences.before_x > offsets.mouse_differences.after_x) {  //move dialog to one end of selection, depending on which end is closest (horizontally) to mouse pointer / finger touch
                offsets.proposed = {x: offsets.after.left, y: offsets.after.top - offsets.dialog.height};
            } else {
                offsets.proposed = {x: offsets.before.left - offsets.dialog.width, y: offsets.before.top - dialog.offsetHeight};
            }
            if(offsets.proposed.x < 1) {
                offsets.proposed.x = 1;
            } else if(offsets.proposed.x > window.innerWidth - offsets.dialog.width) {
                offsets.proposed.x = window.innerWidth - offsets.dialog.width;
            }
            if(offsets.proposed.y < 1) {
                offsets.proposed.y = 1;
            }
            dialog.style.left = offsets.proposed.x + "px";
            dialog.style.top  = offsets.proposed.y + "px";
            dialog.mode = "createElement";
            doctored.util.set_element_chooser_to_element(inline, dialog.element_chooser);
        },
        within_pseudoelement: function(target, position){
            var target_offset = target.getBoundingClientRect(),
                within        = false;

            if(target.classList.contains("inline")       && position.y > target_offset.top  - doctored.CONSTANTS.inline_label_height_in_pixels + target.offsetHeight) {
                within = true;
            } else if(target.classList.contains("block") && position.x < target_offset.left + doctored.CONSTANTS.block_label_width_in_pixels) {
                within = true;
            }
            return within;
        },
        rename_keys: function(attributes, attribute_mapping){
            var new_attributes = {},
                key;

            for(key in attributes) {
                if(attribute_mapping[key]) {
                    new_attributes[attribute_mapping[key]] = attributes[key];
                } else {
                    new_attributes[key] = attributes[key];
                }
            }
            return new_attributes;
        },
        range: function(i) {
            /* jshint ignore:start */
            for(var list=[];list[--i]=i;){} //good ole hoisting
            /* jshint ignore:end */
            return list;
        },
        get_formats: function(){

        },
        simple_transform: function(markup, element_mapping, attribute_mapping) {
            return markup.replace(/<(.*?)>/g, function(match, contents, offset, s){
                var is_a_closing_tag = (match.substr(1, 1) === '/'),
                    element_name,
                    attributes,
                    attributes_string = "",
                    new_element_name,
                    indexOf_whitespace = match.indexOf(" "); // indexOf doesn't support regex, so we'll just match spaces. TODO: make this support other whitespace a la http://stackoverflow.com/questions/273789/is-there-a-version-of-javascripts-string-indexof-that-allows-for-regular-expr

                if(is_a_closing_tag) {
                    element_name = match.substr(2, match.length - 3);
                } else if(indexOf_whitespace === -1){ //is an opening tag without attributes
                    element_name = match.substr(1, match.length - 2);
                } else { //is an opening tag with attributes
                    element_name = match.substr(1, indexOf_whitespace - 1);
                    attributes   = doctored.util.parse_attributes_string(
                                        match.substr(indexOf_whitespace)
                                   );
                    attributes   = doctored.util.rename_keys(attributes, attribute_mapping);
                    attributes_string = doctored.util.build_xml_attributes_from_map(attributes);
                }
                new_element_name = element_mapping[element_name] || element_name;
                return "<" +
                       (is_a_closing_tag ? "/" : "") +
                       new_element_name +
                       attributes_string +
                       ">";
            });
        },
        lint_response: function(errors, max_lines){
            var by_line = {},
                error_line,
                child_node,
                line_number,
                i,
                error;

            for(i = 0; i < errors.error_lines.length; i++){
                error_line = errors.error_lines[i];
                if(error_line.line_number === 0) error_line.line_number = 1; //line 0 and 1 are aggregated for the purposes of display
                if(by_line[error_line.line_number] === undefined) {
                    by_line[error_line.line_number] = [];
                }
                by_line[error_line.line_number].push(error_line);
            }
            return by_line;
        },
        format_lint_errors: function(line_errors){
            var i,
                error_string = "";
            for(i = 0; i < line_errors.length; i++){
                error_string += line_errors[i].message + ". ";
            }
            return error_string;
        },
        to_options_tags: function(list, complex){
            var html = "",
                element_name,
                key,
                escape_chars = {
                    "&": "&nbsp;",
                    "<": "&lt;",
                    ">": "&gt;"
                },
                escape = function(char){
                    return escape_chars[char];
                };

            if(complex === undefined) complex = true;
            if(complex) {
                for(element_name in list){
                    html += '<option value="' + list[element_name].display.replace(/"/g, "&quot;") + '">' + element_name.replace(/[&<>]/g, escape) + "</option>";
                }
            } else {
                for(key in list){
                    element_name = list[key];
                    html += '<option value="' + element_name.replace(/"/g, "&quot;") + '">' + element_name.replace(/[&<>]/g, escape) + "</option>";
                }
            }
            return html;
        }
    };
}());