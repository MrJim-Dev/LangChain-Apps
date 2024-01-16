"use client"
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";

import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase'
import { OpenAIEmbeddings } from '@langchain/openai'
import { createClient } from '@supabase/supabase-js'

// import { retriever } from '../utils/retriever';
import { combineDocuments } from '../utils/combineDocuments';
import { formatConvHistory } from '../utils/formatConvHistory'


import '../public/styles/index.css';

import 'dotenv/config'


export default function Home() {
  const [userInput, setUserInput] = useState('');
  const [convHistory, setConvHistory] = useState([]);

  
  const openAIApiKey = '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'

  const llm = new ChatOpenAI({ 
    openAIApiKey,
    temperature: 0, //creativeness
  });


  const embeddings = new OpenAIEmbeddings({ openAIApiKey })
  const sbApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqcmZ2c2hsdHN6a3VtYXlocm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDUzMzMyMTAsImV4cCI6MjAyMDkwOTIxMH0.guJ8Qs3TsL327Jfc0cCCrGo1tjJ_CrtdZJHm3vpLIKw'
  const sbUrl = 'https://kjrfvshltszkumayhrns.supabase.co'
  const client = createClient(sbUrl, sbApiKey)


  const vectorStore = new SupabaseVectorStore(embeddings, {
      client,
      tableName: 'documents',
      queryName: 'match_documents'
  })

  const retriever = vectorStore.asRetriever()

  const standaloneQuestionTemplate = `Given some covnersation history (if any) a question, convert it to a standalone question. 
  conversation history: {conv_history}
  question: {question} 
  standalone question:`

  const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate)

  const answerTemplate = `You are a helpful and enthusiastic support bot who can answer a given question about Scrimba based on the context provided and the conversation history. Try to find the answer in the context. If the answer is not given in the context, find the answer in the conversation history if possible. If you really don't know the answer, say "I'm sorry, I don't know the answer to that." And direct the questioner to email help@scrimba.com. Don't try to make up an answer. Always speak as if you were chatting to a friend.
  conversation history: {conv_history}
  context: {context}
  question: {question}
  answer: `

  const answerPrompt = PromptTemplate.fromTemplate(answerTemplate)

  const standaloneQuestionChain = RunnableSequence.from([
      standaloneQuestionPrompt,
      llm,
      new StringOutputParser()
  ])

  const retrieverChain = RunnableSequence.from([
      prevResult => prevResult.standalone_question,
      retriever,
      combineDocuments
  ])

  const answerChain = RunnableSequence.from([
      answerPrompt,
      llm,
      new StringOutputParser()
  ])

  const chain = RunnableSequence.from([
      {
          standalone_question: standaloneQuestionChain,
          original_input: new RunnablePassthrough()
      },
      {
          context: retrieverChain,
          question: ({original_input}) => original_input.question,
          conv_history: ({original_input}) => original_input.conv_history
  
      },
      answerChain
  ])
  // const chain = standaloneQuestionPrompt.pipe(llm).pipe(new StringOutputParser()).pipe(retriever).pipe(combineDocuments).pipe(answerPrompt)


  async function progressConversation() {
      const chatbotConversation = document.getElementById('chatbot-conversation-container')
      const question = userInput
      setUserInput('');

      // add human message
      const newHumanSpeechBubble = document.createElement('div')
      newHumanSpeechBubble.classList.add('speech', 'speech-human')
      chatbotConversation.appendChild(newHumanSpeechBubble)
      newHumanSpeechBubble.textContent = question
      chatbotConversation.scrollTop = chatbotConversation.scrollHeight

      const response = await chain.invoke({
          question: question,
          conv_history: formatConvHistory(convHistory)
      })

      convHistory.push(question)
      convHistory.push(response)

      // add AI message
      const newAiSpeechBubble = document.createElement('div')
      newAiSpeechBubble.classList.add('speech', 'speech-ai')
      chatbotConversation.appendChild(newAiSpeechBubble)
      newAiSpeechBubble.textContent = response
      chatbotConversation.scrollTop = chatbotConversation.scrollHeight
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    progressConversation(userInput);
  };

  return (
    <div>
      <Head>
        <title>Scrimba Chatbot</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Poppins&family=Roboto&display=swap" rel="stylesheet" />
      </Head>

      <main>
        <section className="chatbot-container">
          <div className="chatbot-header">
            {/* Use Image component for optimized image loading */}
            {/* <Image src="/images/logo-scrimba.svg" className={styles.logo} alt="logo" /> */}
            <p className="sub-heading">Knowledge Bank</p>
          </div>
          <div className="chatbot-conversation-container" id="chatbot-conversation-container">
            {/* Chat content goes here */}
          </div>
          <form id="form" className="chatbot-input-container">
            <input name="user-input" type="text" id="user-input" required value={userInput} onChange={(e) => setUserInput(e.target.value)}/>
            <button id="submit-btn" className="submit-btn" onClick={handleSubmit}>
                <img src="images/send.svg" className="send-btn-icon" />
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
