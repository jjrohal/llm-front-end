const query = (obj) => Object.keys(obj) .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k])) .join("&");
const markdown = window.markdownit();
const message_box = document.getElementById(`messages`);
const message_input = document.getElementById(`message-input`);
const system_input = document.getElementById(`system-input`);
const box_conversations = document.querySelector(`.top`);
const stop_generating = document.querySelector(`.stop_generating`);
const send_button = document.querySelector(`#send-button`);
let prompt_lock = false;
const messageHistory = [];

var system_message = "";
var model = ""; 
var temperatureString = "0.7°";
var cleanedString = temperatureString.replace(/[^0-9\.]/g, '');
var temperature = parseFloat(cleanedString);
var API_URL = "http://localhost:21004/v1"; // this should NOT have a trailing slash
var API_KEY = "1234";

// Add event listeners
document.addEventListener("DOMContentLoaded", function() {
	var modelSelect = document.getElementById(`model`);
	var temperatureSelect = document.getElementById(`temperature`);

	modelSelect.addEventListener("change", function() {
		model = modelSelect.options[modelSelect.selectedIndex].value;
		console.log('Model value changed to: ' + model);
		// new conversation when switching models
		new_conversation();
	});

	temperatureSelect.addEventListener("change", function() {
		temperatureString = temperatureSelect.options[temperatureSelect.selectedIndex].value;
		cleanedString = temperatureString.replace(/[^0-9\.]/g, '');
		temperature = parseFloat(cleanedString);
		console.log('Temperature value changed to: ' + temperature);
	});
});

hljs.addPlugin(new CopyButtonPlugin());

function resizeTextarea(textarea) {
	textarea.style.height = '80px';
	textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

const format = (text) => {
	return text.replace(/(?:\r\n|\r|\n)/g, "<br>");
};

message_input.addEventListener("blur", () => {
	window.scrollTo(0, 0);
});

const clear_all_data = async () => {
    const confirmed = confirm("Are you sure you want to clear all data?");
    if (confirmed) {
        localStorage.clear();
        await new_conversation();
    }
};

const handle_ask = async () => {
	message_input.style.height = `80px`;
	message_input.focus();

	window.scrollTo(0, 0);
	let message = message_input.value;

	if (message.length > 0) {
		// clear the box content
		message_input.value = ``;

		// make sure keys exist in local storage
		if (!localStorage.getItem("system_message")) localStorage.setItem("system_message", system_message);
		if (!localStorage.getItem("API_KEY")) localStorage.setItem("API_KEY", API_KEY);
		if (!localStorage.getItem("API_URL")) localStorage.setItem("API_URL", API_URL);

		// send message to api
		await ask_gpt(message);
	}
};

const remove_cancel_button = async () => {
	stop_generating.classList.add(`stop_generating-hiding`);

	setTimeout(() => {
		stop_generating.classList.remove(`stop_generating-hiding`);
		stop_generating.classList.add(`stop_generating-hidden`);
	}, 300);
};

const ask_gpt = async (message) => {
	try {
		message_input.value = ``;
		message_input.innerHTML = ``;
		message_input.innerText = ``;

		title = message.split(' ').slice(0,5).join(' '); // first five words
		add_conversation(window.conversation_id, title);
		window.scrollTo(0, 0);
		window.controller = new AbortController();

		prompt_lock = true;
		window.text = ``;
		window.token = message_id();

		stop_generating.classList.remove(`stop_generating-hidden`);

		message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${user_image}
                </div>
                <div class="content" id="user_${token}"> 
                    ${format(message)}
                </div>
            </div>
        `;
        
        document.querySelectorAll('code:not(p code):not(li code)').forEach((el) => {
		hljs.highlightElement(el);
		el.classList.add('processed');
        });

		message_box.scrollTo({
				top: message_box.scrollHeight,
				behavior: "smooth"
			});
		window.scrollTo(0, 0);
		await new Promise((r) => setTimeout(r, 500));
		window.scrollTo(0, 0);

		message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${gpt_image}
                </div>
                <div class="content" id="gpt_${window.token}">
                    <div id="cursor"></div>
                </div>
            </div>
        `;

		message_box.scrollTo({
				top: message_box.scrollHeight,
				behavior: "smooth"
			});
		window.scrollTo(0, 0);
		await new Promise((r) => setTimeout(r, 1000));
		window.scrollTo(0, 0);
        
        messageHistory.push(message);

       const postData = {
       model: model,
       temperature: temperature,
       stream: true,
       messages: []
       }; 

       let isFirstMessage = true;

       for (const message of messageHistory) {
       postData.messages.push({ role: "user", content: message });

       if (isFirstMessage) {
       postData.messages.push({ role: "system", content: `${system_message}` });
       isFirstMessage = false;
         }
       } 
       

       const response = await fetch(`${API_URL}/chat/completions`, {
       signal: window.controller.signal,
       conversation_id: window.conversation_id,    
       method: "POST",   
	//    headers: {
	// 	"Content-Type": "application/json"
	// 	},
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`
        },
       body: JSON.stringify(postData)
       })
		console.log('Connected API');
		// Read the response as a stream of data
		const reader = response.body.getReader();
		const decoder = new TextDecoder("utf-8");
      while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      // Massage and parse the chunk of data
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      const parsedLines = lines
        .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
        .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
        .map((line) => JSON.parse(line)); // Parse the JSON string

      for (const parsedLine of parsedLines) {
        const { choices } = parsedLine;
        const { delta } = choices[0];
        const { content } = delta;
        // Update the UI with the new content
        if (content) {
		text += content;
           }
        }
			document.getElementById(`gpt_${window.token}`).innerHTML =
				markdown.render(text);
			document.querySelectorAll('code:not(p code):not(li code)').forEach((el) => {
				hljs.highlightElement(el);
				el.classList.add('processed');
			});

			window.scrollTo(0, 0);
			message_box.scrollTo({
				top: message_box.scrollHeight,
				behavior: "auto"
			});
            
        }
        
		add_message(window.conversation_id, "user", message);
		add_message(window.conversation_id, "assistant", text);

		message_box.scrollTop = message_box.scrollHeight;
		await remove_cancel_button();
		prompt_lock = false;

		await load_conversations(20, 0);
		window.scrollTo(0, 0);
	} catch (e) {
		add_message(window.conversation_id, "user", message);

		message_box.scrollTop = message_box.scrollHeight;
		await remove_cancel_button();
		prompt_lock = false;

		await load_conversations(20, 0);
        
        console.log(e);

		let cursorDiv = document.getElementById("cursor");
		if (cursorDiv) cursorDiv.parentNode.removeChild(cursorDiv);
        
		if (e.name != "AbortError") {
			let error_message = "Oops! Something went wrong, please try again later. Check error in console.";

			document.getElementById(`gpt_${window.token}`).innerHTML = error_message;
			add_message(window.conversation_id, "assistant", error_message);
		} else {
			document.getElementById(`gpt_${window.token}`).innerHTML += " [aborted]";
			add_message(window.conversation_id, "assistant", text + " [aborted]");
		}

    window.scrollTo(0, 0);
  }
};
const clear_conversations = async () => {
	const elements = box_conversations.childNodes;
	let index = elements.length;

	if (index > 0) {
		while (index--) {
			const element = elements[index];
			if (
				element.nodeType === Node.ELEMENT_NODE &&
				element.tagName.toLowerCase() !== `button`
			) {
				box_conversations.removeChild(element);
			}
		}
	}
};

const clear_conversation_HTML = async () => {
	let messages = message_box.getElementsByTagName(`div`);

	while (messages.length > 0) {
		message_box.removeChild(messages[0]);
	}
};

const clear_conversation_history = async () => {
	await delete_conversation(window.conversation_id);
	await clear_conversation_HTML();
  };

const show_option = async (conversation_id) => {
	const conv = document.getElementById(`conv-${conversation_id}`);
	const yes = document.getElementById(`yes-${conversation_id}`);
	const not = document.getElementById(`not-${conversation_id}`);

	conv.style.display = "none";
	yes.style.display = "block";
	not.style.display = "block";
}

const hide_option = async (conversation_id) => {
	const conv = document.getElementById(`conv-${conversation_id}`);
	const yes = document.getElementById(`yes-${conversation_id}`);
	const not = document.getElementById(`not-${conversation_id}`);

	conv.style.display = "block";
	yes.style.display = "none";
	not.style.display = "none";
}

const delete_conversation = async (conversation_id) => {
	localStorage.removeItem(`conversation:${conversation_id}`);

	const conversation = document.getElementById(`convo-${conversation_id}`);

	// only remove if conversation is not null
	if (conversation) {
		conversation.remove();
	}
	
	if (window.conversation_id == conversation_id) {
		await new_conversation();
	}

	await load_conversations(20, 0, true);
};

const set_conversation = async (conversation_id) => {
	window.conversation_id = conversation_id;

	await clear_conversation_HTML();
	await load_conversation(conversation_id);
	await load_conversations(20, 0, true);
};

const new_conversation = async () => {
	window.conversation_id = uuid();

	await clear_conversation_HTML();
	await load_conversations(20, 0, true);
};

const load_conversation = async (conversation_id) => {
	let conversation = await JSON.parse(
		localStorage.getItem(`conversation:${conversation_id}`)
	);
	console.log(conversation, conversation_id);

	// Update window.conversation_id
	window.conversation_id = conversation_id;

	// update system_message
	setSystemMessage(conversation.system_message);

	// loop through all interactions
	for (item of conversation.items) {
		message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${item.role == "assistant" ? gpt_image : user_image}
                </div>
                <div class="content">
                    ${
                      item.role == "assistant"
                        ? markdown.render(item.content)
                        : item.content
                    }
                </div>
            </div>
        `;
	}

	document.querySelectorAll('code:not(p code):not(li code)').forEach((el) => {
		hljs.highlightElement(el);
		el.classList.add('processed');
	});

	message_box.scrollTo({
		top: message_box.scrollHeight,
		behavior: "smooth"
	});

	setTimeout(() => {
		message_box.scrollTop = message_box.scrollHeight;
	}, 500);
};

const get_conversation = async (conversation_id) => {
	let conversation = await JSON.parse(
		localStorage.getItem(`conversation:${conversation_id}`)
	);
	return conversation.items;
};

const add_conversation = async (conversation_id, title) => {
	if (localStorage.getItem(`conversation:${conversation_id}`) == null) {
		// created - Unix timestamp in seconds when chat completion was created (Date.now() gives time in milliseconds)
		const created = Math.floor(Date.now() / 1000); 

		// create the conversation item in localStorage
		localStorage.setItem(
			`conversation:${conversation_id}`,
			JSON.stringify({
				id: conversation_id,
				title: title,
				created: created,
				model: model,
				system_message: system_message,
				items: [],
			})
		);
	}
};

const add_message = async (conversation_id, role, content) => {
	before_adding = JSON.parse(
		localStorage.getItem(`conversation:${conversation_id}`)
	);

	before_adding.items.push({
		role: role,
		content: content,
	});

	localStorage.setItem(
		`conversation:${conversation_id}`,
		JSON.stringify(before_adding)
	); // update conversation
};

const load_conversations = async (limit, offset, loader) => {

	let conversations = [];
	for (let i = 0; i < localStorage.length; i++) {
		if (localStorage.key(i).startsWith("conversation:")) {
			let conversation = localStorage.getItem(localStorage.key(i));
			conversations.push(JSON.parse(conversation));
		}
	}

	// Sort conversations by created field in descending order
	conversations.sort((a, b) => b.created - a.created);

	await clear_conversations();

	for (conversation of conversations) {
		// get created date and convert to string for display
		const createdAt       = new Date(conversation.created * 1000); // convert seconds to milliseconds
		const createdAtString = new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		  }).format(createdAt);

		box_conversations.innerHTML += `
    <div class="convo" id="convo-${conversation.id}">
      <div class="left" onclick="set_conversation('${conversation.id}')">
          <i class="fa-solid fa-comments"></i>
          <span class="convo-title">${conversation.title}<br />
		  <span class="convo-subtitle">${createdAtString}</span>
		  </span>
		  
      </div>
      <i onclick="show_option('${conversation.id}')" class="fa-solid fa-trash" id="conv-${conversation.id}"></i>
      <i onclick="delete_conversation('${conversation.id}')" class="fa-solid fa-check" id="yes-${conversation.id}" style="display:none;"></i>
      <i onclick="hide_option('${conversation.id}')" class="fa-solid fa-x" id="not-${conversation.id}" style="display:none;"></i>
    </div>
    `;
	}

	document.querySelectorAll('code:not(p code):not(li code)').forEach((el) => {
		hljs.highlightElement(el);
		el.classList.add('processed');
	});
};

const export_conversations = async (type) => {
	// only output HTML or JSON
	if ((type !== 'HTML') && (type !== 'JSON')) return;

	const conversations = {};
	for (let i = 0; i < localStorage.length; i++) {
	  const key = localStorage.key(i);
	  if (key.startsWith('conversation:')) {
		const conversationId = key.replace('conversation:', '');
		const conversationData = JSON.parse(localStorage.getItem(key));
		conversations[conversationId] = conversationData;
	  }
	}
  
	// initialize zip storage
	const zip = new JSZip();
	filename  = `conversations${type}_${convertToYYYYMMDDHHmm(new Date())}.zip`;

	Object.keys(conversations).forEach((conversationId) => {
		const conversationData = conversations[conversationId];
		if (type == 'JSON') {
			const content = JSON.stringify(conversationData, null, 2);
			zip.file(`${convertToYYYYMMDDHHmm(new Date(conversationData.created * 1000))}-${conversationId}.json`, content);
		}
		else {
			const content = generateHtml(conversationData);
			zip.file(`${convertToYYYYMMDDHHmm(new Date(conversationData.created * 1000))}-${conversationId}.html`, content);
		}		
	});
	
	// create a temporary copy of the file for download
	const blob = await zip.generateAsync({ type: 'blob' });
	const url  = URL.createObjectURL(blob);
	const a    = document.createElement('a');
	a.href     = url;
	a.download = filename;
	a.click(); // automatically download the file
};

// convert unix milliseconds to YYYY-MM-DD_HH-mm
const convertToYYYYMMDDHHmm = (datetime) => {
	const year   = datetime.getFullYear();
	const month  = (`0${datetime.getMonth() + 1}`).slice(-2);
	const day    = (`0${datetime.getDate()}`).slice(-2);
	const hour   = (`0${datetime.getHours()}`).slice(-2);
	const minute = (`0${datetime.getMinutes()}`).slice(-2);
	return `${year}-${month}-${day}_${hour}-${minute}`;
};

const generateHtml = (conversationData) => {
	const messages = conversationData.items.map((item) => {
	  const role = item.role === 'assistant'? 'Assistant:' : 'User:';
	  const content = markdown.render(item.content);
	  return `
		<div class="message">
		  <div class="user">${role}</div>
		  <div class="content">${content}</div>
		</div>
	  `;
	}).join('');
  
	return `
	  <!DOCTYPE html>
	  <html lang="en">
		<head>
		  <meta charset="UTF-8">
		  <meta name="viewport" content="width=device-width, initial-scale=1.0">
		  <title>Conversation Started at ${convertToYYYYMMDDHHmm(new Date(conversationData.created * 1000))}</title>
		  <style>
			body {
			  font-family: Arial, sans-serif;
			}
		   .message {
			  margin-bottom: 20px;
			}
		   .user {
			  display: inline-block;
			  margin-right: 10px;
			  font-weight: bold;
			}
		   .content {
			  display: inline-block;
			}
		  </style>
		</head>
		<body>
		  <h1>Conversation ${conversationData.id}</h1>
		  <p><b>Started:</b> ${convertToYYYYMMDDHHmm(new Date(conversationData.created * 1000))}</p>
		  <p><b>Model:</b> ${conversationData.model}</p>
		  <p><b>System Message:</b> ${conversationData.system_message}</p>
		  ${messages}
		</body>
	  </html>
	`;
  };

const change_base_api = async () => {
	// make popup appear
	document.getElementById('baseapi-popup').classList.remove('hidden');
	document.getElementById('baseapi-background-blur').classList.remove('hidden');
	// focus on base URL input
	document.getElementById('base-url').focus()
	// put the current values in
	document.getElementById('base-url').value = API_URL;
	document.getElementById('api-key').value = API_KEY;
};

document.getElementById(`cancelButton`).addEventListener(`click`, async () => {
	window.controller.abort();
	console.log(`aborted ${window.conversation_id}`);
});

function h2a(str1) {
	var hex = str1.toString();
	var str = "";

	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}

	return str;
}

const uuid = () => {
	return `xxxxxxxx-xxxx-4xxx-yxxx-${Date.now().toString(16)}`.replace(
		/[xy]/g,
		function(c) {
			var r = (Math.random() * 16) | 0,
				v = c == "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		}
	);
};

const message_id = () => {
	random_bytes = (Math.floor(Math.random() * 1338377565) + 2956589730).toString(
		2
	);
	unix = Math.floor(Date.now() / 1000).toString(2);

	return BigInt(`0b${unix}${random_bytes}`).toString();
};

window.onload = async () => {
	load_settings_localstorage();

	conversations = 0;
	for (let i = 0; i < localStorage.length; i++) {
		if (localStorage.key(i).startsWith("conversation:")) {
			conversations += 1;
		}
	}

	if (conversations == 0) localStorage.clear();

	await setTimeout(() => {
		load_conversations(20, 0);
	}, 1);

	message_input.addEventListener(`keydown`, async (evt) => {
		if (prompt_lock) return;
		if (evt.keyCode === 13 && !evt.shiftKey) {
			evt.preventDefault();
			console.log('pressed enter in prompt');
			await handle_ask();
		} else {
			message_input.style.removeProperty("height");
			message_input.style.height = message_input.scrollHeight + 4 + "px";
		}
	});

	send_button.addEventListener(`click`, async () => {
		console.log("clicked send in prompt");
		if (prompt_lock) return;
		await handle_ask();
	});

	// check if there is a system_message in localStorage, if so use that
	if (localStorage.getItem("system_message")) {
		system_message = localStorage.getItem("system_message");
	}

	// set system message - might be stored or just the default ""
	setSystemMessage(system_message);

	// check if there is an API_KEY in localStorage, if so use that
	if (localStorage.getItem("API_KEY")) {
		API_KEY = localStorage.getItem("API_KEY");
	}
	else {
		// use default
		localStorage.setItem("API_KEY", API_KEY);
	}

	// check if there is an API_URL in localStorage, if so use that
	if (localStorage.getItem("API_URL")) {
		API_URL = removeTrailingSlash(localStorage.getItem("API_URL"));
	}
	else {
		// use default
		localStorage.setItem("API_URL", API_URL);
	}

	// click the system prompt box
	document.getElementById('system').addEventListener('click', async () => {
		console.log("clicked into system prompt");
		if (prompt_lock) return;
		document.getElementById('system').classList.add('hidden');
		document.getElementById('system-prompt').classList.remove('hidden');
		// set focus on textarea
		system_input.focus()
	});

	// click save button in system prompt
	document.getElementById('save-system-button').addEventListener('click', async () => {
		console.log("clicked save in system prompt");
		if (prompt_lock) return;
		await handle_save_system();
	});

	// pressed enter in system prompt
	system_input.addEventListener(`keydown`, async (evt) => {
		if (prompt_lock) return;
		if (evt.keyCode === 13 && !evt.shiftKey) {
			evt.preventDefault();
			console.log('pressed enter in system prompt');
			await handle_save_system();
		} else {
			system_input.style.removeProperty("height");
			system_input.style.height = message_input.scrollHeight + 4 + "px";
		}
	});

	// clicked cancel in system prompt
	document.getElementById('cancel-system-button').addEventListener('click', async () => {
		console.log("clicked cancel in system prompt");
		system_input.style.height = `80px`;
		system_input.focus();
		window.scrollTo(0, 0);
		document.getElementById('system-input').value = system_message;
		document.getElementById('system').classList.remove('hidden');
		document.getElementById('system-prompt').classList.add('hidden');
	});

	// cancel button in api popup
	document.getElementById('cancel-credentials').addEventListener('click', async () => {
		console.log("clicked cancel in api popup");
		// hide the popup
		document.getElementById('baseapi-popup').classList.add('hidden');
		document.getElementById('baseapi-background-blur').classList.add('hidden');
	});

	// save button in api popup
	document.getElementById('save-credentials').addEventListener('click', async () => {
		console.log("clicked save in api popup");
		
		// save the new values
		if (document.getElementById('base-url').value !== API_URL) {
			API_URL = removeTrailingSlash(document.getElementById('base-url').value);
			localStorage.setItem("API_URL", API_URL);
		}
		if (document.getElementById('api-key').value !== API_KEY) {
			API_KEY = document.getElementById('api-key').value;
			localStorage.setItem("API_KEY", API_KEY);
		}

		// call get models
		getModels();

		// hide the popup
		document.getElementById('baseapi-popup').classList.add('hidden');
		document.getElementById('baseapi-background-blur').classList.add('hidden');
	});

	// try getting the models and check the connection
	getModels();
	
	register_settings_localstorage();
};

const getModels = async () => {
//async function getModels() {
	try {
		console.log('Sending response to /models endpoint');

		const response = await fetch(`${API_URL}/models`, {
			method: "GET",   
			headers: {
				Authorization: `Bearer ${API_KEY}`
			}
		});

		// remove no-connection class
		document.getElementById('model').classList.remove('no-connection');

		// clear the existing options in the select
		document.getElementById('model').innerHTML = '';

		// parse response JSON
		const responseData = await response.json()

		// parse results for each model in response
		responseData.data.forEach(model_object => {
			// extract the id of the model
			const modelID = model_object.id;

			// create a new option element
			const option = document.createElement('option');

			// set the value and innerHTML of the option element
			option.value     = modelID;
			option.innerHTML = modelID;

			// append the option to the select element
			document.getElementById('model').appendChild(option);
		});

		// if model in localstorage select that one, otherwise model = 0 in localstorage
		if (localStorage.getItem("model")) {
			document.getElementById('model').selectedIndex = localStorage.getItem("model");
			model = responseData.data[localStorage.getItem("model")].id; // store the actual model name in the model variable
		} else {
			localStorage.setItem("model", 0);
			model = responseData.data[0].id; // store the actual model name in the model variable
		}

		console.log('Successfully updated models');

	} catch(e) {
		console.log(e);
		// add no-connection class to select id="model" and add only one value and change title
		console.log('Cannot connect');
		document.getElementById('model').classList.add('no-connection');
		document.getElementById('model').innerHTML = '<option value="NO CONNECTION">FIX BASE URL AND API KEY</option>';
		document.getElementById('model').title = `Could not connect to server = ${API_URL}/models with API_KEY = ${API_KEY}. Please enter values and retry the connection.`;
	}
}

function setSystemMessage(message) {
	if (message) {
		document.getElementById("system-message").innerHTML = `<b>Optional System Message:</b> ${message}`;
	}
	else {
		document.getElementById("system-message").innerHTML = "Set Optional System Message";
	}
	
	document.getElementById("system-input").value = message

	localStorage.setItem("system_message", message);
}

const handle_save_system = async () => {
	system_input.style.height = `80px`;
	system_input.focus();
	window.scrollTo(0, 0);

	// check if new system message differs from old one
	if (system_input.value !== system_message) {
		system_message = system_input.value;
		setSystemMessage(system_message);
		await new_conversation(); // start new conversation since only one system_message per convo
	}

	document.getElementById('system').classList.remove('hidden');
	document.getElementById('system-prompt').classList.add('hidden');
};

function removeTrailingSlash(str) {
	if (str.endsWith('/')) {
		return str.slice(0,-1);
	} else {
		return str;
	}
}

document.querySelector(".mobile-sidebar").addEventListener("click", (event) => {
	const sidebar = document.querySelector(".conversations");

	if (sidebar.classList.contains("shown")) {
		sidebar.classList.remove("shown");
		event.target.classList.remove("rotated");
	} else {
		sidebar.classList.add("shown");
		event.target.classList.add("rotated");
	}

	window.scrollTo(0, 0);
});

const register_settings_localstorage = async () => {
	settings_ids = ["model", "temperature"];
	settings_elements = settings_ids.map((id) => document.getElementById(id));
	settings_elements.map((element) =>
		element.addEventListener(`change`, async (event) => {
			switch (event.target.type) {
				case "checkbox":
					localStorage.setItem(event.target.id, event.target.checked);
					break;
				case "select-one":
					localStorage.setItem(event.target.id, event.target.selectedIndex);
					break;
				default:
					console.warn("Unresolved element type");
			}
		})
	);
};

const load_settings_localstorage = async () => {
	settings_ids = ["model", "temperature"];
	settings_elements = settings_ids.map((id) => document.getElementById(id));
	settings_elements.map((element) => {
		if (localStorage.getItem(element.id)) {
			switch (element.type) {
				case "checkbox":
					element.checked = localStorage.getItem(element.id) === "true";
					break;
				case "select-one":
					element.selectedIndex = parseInt(localStorage.getItem(element.id));
					break;
				default:
					console.warn("Unresolved element type");
			}
		}
	});
};

function toggleTheme() {
  var element = document.documentElement;
  element.classList.toggle("dark");
  var sunIcon = document.getElementById("sun-icon");
  var moonIcon = document.getElementById("moon-icon");

  if (element.classList.contains("dark")) {
    sunIcon.style.display = "none";
    moonIcon.style.display = "inline-block";
    var oldlink = document.getElementsByTagName("link").item(1);
    var newlink = document.createElement("link");
    newlink.setAttribute("rel", "stylesheet");
    newlink.setAttribute("type", "text/css");
    newlink.setAttribute("href", "assets/css/dracula.css");
    document.getElementsByTagName("head").item(0).replaceChild(newlink, oldlink);
    localStorage.setItem("theme", "dark"); // Save theme state as "dark"
  } else {
    sunIcon.style.display = "inline-block";
    moonIcon.style.display = "none";
    var oldlink = document.getElementsByTagName("link").item(1);
    var newlink = document.createElement("link");
    newlink.setAttribute("rel", "stylesheet");
    newlink.setAttribute("type", "text/css");
    newlink.setAttribute("href", "assets/css/googlecode.min.css");
    document.getElementsByTagName("head").item(0).replaceChild(newlink, oldlink);
    localStorage.setItem("theme", "light"); // Save theme state as "light"
  }
}

// Set the initial theme
var theme = localStorage.getItem("theme");
if (theme === "dark") {
  toggleTheme();
}