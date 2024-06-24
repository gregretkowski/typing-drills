#!/usr/bin/env python3
# -*- coding: utf-8 -*-

''' PYTHON CHEATSHEET '''

import argparse
import json
import logging
import os
import re
import sys
from urllib.parse import urlparse
from math import pi

# Third party imports
import requests
from requests.auth import HTTPBasicAuth

VERSION = '1.0'

class MyClass():
    # pylint: disable=missing-docstring, missing-function-docstring
    # pylint: disable=pointless-statement, unused-variable
    # pylint: disable=pointless-string-statement
    def __init__(self, log=logging.getLogger(__name__) ):
        self.log = log
        self.log.info('MyClass instance created')
        self.one_instance_var = 'foo'

    def some_func(self, an_argument='foo'):
        """ This is a docstring
        """
        self.some_func() # Call another instance function
        self.one_instance_var = an_argument

    def string_ops(self):
        my_string = 'hello there'
        my_string[4] # SHows the 4th char
        string_list = my_string.split(' ')
        joined_string = ' '.join(string_list)
        print(f"foo {string_list[0]} bar: {string_list[1]}")

    def ds_ops(self):
        """ Working with lists and dicts """
        mylist = ['spam', 'eggs', 100, 200] # Creates a list
        idx = 1
        mylist.insert(idx,"foo")
        mylist.remove("item value")
        del mylist[idx]
        mylist.pop(idx) # Returns item in 'idx' pos, or last item
        mylist.index('item_value')
        mylist.count('item_value')
        mylist.sort()
        mylist.reverse()
        len(mylist)
        [mylist[-1], mylist[:-2]] # last item, all but last two items
        mylist.append(5,6) # 1,2,3,4,[5,6]
        mylist.extend(5,6) # 1,2,3,4,5,6
        """ Dicts / Dictionary operations """
        tel = {'aj': 1234, 'jk': 5678}
        dict([('foo', 1234),('bar', 5678)])
        'aj' in tel
        tel.keys()
        tel.items()

    def conditionals_and_loops(self):
        """ Some conditionals examples, and some loops
            uses 'if', 'elif', 'else'.
            'break' breaks out of loops, 'continue' short-circuts
            'while' can be used for loops',
        """
        for i in range(21):
            pass
        knights={'f':1,'g':2}
        for k,v in knights.items() :
            print(k,v)
        my_list=[1,2,3,4]
        for idx,value in enumerate(my_list):
            print(idx,value)

    def file_io(self):
        """ Reading and writig to files """
        x = int(input("Please enter an integer:"))
        [ sys.argv[0], sys.argv[1]] # ['prodname', 'first-arg']
        with open('foo','w', encoding='utf-8') as fh:
            fh.write('hi there')
            fh.close()
        with open('foo','r', encoding='utf-8') as fh:
            num_bytes=10
            fh.read(num_bytes)
            fh.readline() # A line string
            fh.readline() # a list of strings
        # Other valid open modes: 'r+', 'w+', 'a', 'a+'

    def using_yaml_and_json(self):
        """ Conventions.. safe_load, load, dump operates on
            file handles.. loads/dumps operates with strings
        """
        with open('some_datafile','r+', encoding='utf-8') as fh:
            #myData = yaml.safe_load(fh)
            #yaml.dump(myData,fh)
            fh.reset()
            my_data = json.load(fh)
            json.dump(my_data,fh)


    def http_requests(self):
        # how to parse a url, make a http / rest request with json headers
        # etc
        query = {'lat':'45', 'lon':'180'}
        response = requests.get('http://foo.ai/bar', params=query, timeout=5)
        my_dict = response.json()
        response = requests.post('https://foo.ai/bar', data = {'key':'value'},
                                 timeout=5)

        # Authentication examples...
        session = requests.Session()
        session.headers.update({'Authorization': 'Bearer {access_token}'})
        session.get('https://api.github.com/user',
            auth=HTTPBasicAuth('username', 'password'), timeout=5
        )

        # URL Parsing
        o = urlparse("http://docs.python.org:80/3/library/urllib.parse.html?"
             "highlight=params#url-parsing")
        o._replace(fragment="").geturl()

    def comprehensions(self):
        """ Using Comprehensions """
        squares = [x**2 for x in range(10)]
        z = [x for x in squares if x >= 0]
        z = [str(round(pi, i)) for i in range(1, 6)]
        z = {x: x**2 for x in (2,4,6)} # Dict creation via comp.

    def some_other_ops(self):
        os.path.isfile('some_file')
        os.path.exists('some_file')
        os.makedirs('new_dir')
        re.search(r'^First','First Line OPf FIle') # returns match obj

        try:
            raise ValueError('oops!') # subclass of Exception
        except ValueError as e:
            print(f"Something happened {e}")
        finally:
            'this_always_happens'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="My App", epilog='V'+VERSION)
    parser.add_argument('--debug', action='store_true', default=False,
                        help='Enable debug logging')
    args = parser.parse_args()

    logger = logging.getLogger(__name__)
    if args.debug:
        logger.setLevel(logging.DEBUG)

    print('This script is being run directly')
    myInstance = MyClass(log=logger)
    myInstance.string_ops()
    dir(myInstance)
